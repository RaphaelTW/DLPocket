const state = {
  appInfo: null,
  depsReady: false,
  preparing: false,
  kind: 'video',
  format: 'mp4',
  downloads: new Map(),
  update: null,
  updateFile: null,
  media: null,
  history: [],
  settings: { theme: 'system', language: 'system', quality: 'auto', format: 'mp4', autoUpdates: true, completion: 'nothing', cookieBrowser: 'none', concurrency: 2, updateChannel: 'stable', silentUpdate: false },
  pendingQueue: [],
  activeCount: 0,
  completionResolvers: new Map()
};

const formats = {
  video: [
    ['mp4', 'MP4'],
    ['mkv', 'MKV'],
    ['webm', 'WebM'],
    ['mov', 'MOV (conversão)'],
    ['avi', 'AVI (conversão)'],
    ['flv', 'FLV (conversão)']
  ],
  audio: [
    ['mp3', 'MP3'],
    ['m4a', 'M4A'],
    ['wav', 'WAV'],
    ['flac', 'FLAC'],
    ['opus', 'Opus'],
    ['aac', 'AAC'],
    ['alac', 'ALAC'],
    ['vorbis', 'Vorbis (OGG)']
  ]
};

const $ = (selector) => document.querySelector(selector);
const urlInput = $('#url-input');
const urlError = $('#url-error');
const formatSelect = $('#format-select');
const downloadButton = $('#download-button');
const downloadButtonText = downloadButton.querySelector('span');
const dependencyBadge = $('#dependency-badge');
const dependencyLabel = $('#dependency-label');
const setupPanel = $('#setup-panel');
const setupMessage = $('#setup-message');
const setupProgressBar = $('#setup-progress-bar');
const destinationPath = $('#destination-path');
const downloadList = $('#download-list');
const emptyState = $('#empty-state');
const queueCount = $('#queue-count');
const itemTemplate = $('#download-item-template');
const updateCard = $('#update-card');
const updateTitle = $('#update-title');
const updateMessage = $('#update-message');
const updateDownload = $('#update-download');
const updateDismiss = $('#update-dismiss');
const updateProgressTrack = updateCard.querySelector('.update-progress-track');
const updateProgressBar = $('#update-progress-bar');
const qualitySelect = $('#quality-select');
const fpsSelect = $('#fps-select');
const codecSelect = $('#codec-select');
const mediaPreview = $('#media-preview');
const settingsDialog = $('#settings-dialog');
let inspectTimer = null;

function prettyKind(kind) {
  return kind === 'audio' ? 'Áudio' : 'Vídeo';
}

function selectedFolderKind() {
  return state.kind === 'audio' ? 'audio' : 'video';
}

function setDependencyBadge(mode, label) {
  dependencyBadge.classList.remove('is-checking', 'is-ready', 'is-working', 'is-error');
  dependencyBadge.classList.add(mode);
  dependencyLabel.textContent = label;
}

function setPreparing(preparing) {
  state.preparing = preparing;
  downloadButton.disabled = preparing;
  setupPanel.hidden = !preparing;
  if (!preparing) setupProgressBar.style.width = '0%';
}

function renderFormats() {
  formatSelect.replaceChildren();
  for (const [value, label] of formats[state.kind]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    formatSelect.appendChild(option);
  }
  const preferred = state.settings.format;
  formatSelect.value = formats[state.kind].some(([value]) => value === preferred) ? preferred : formats[state.kind][0][0];
  state.format = formatSelect.value;
  updateComposerCopy();
  updateEstimate();
}

function updateComposerCopy() {
  state.format = formatSelect.value;
  $('#video-options').hidden = state.kind === 'audio';
  document.querySelectorAll('.audio-option').forEach((element) => { element.hidden = state.kind !== 'audio'; });
  const copy = translations?.[resolvedLanguage?.(state.settings.language)] || translations?.['pt-BR'];
  downloadButtonText.textContent = copy ? `${copy.download} ${state.kind === 'audio' ? copy.audio.toLowerCase() : copy.video.toLowerCase()}` : `Baixar ${state.kind === 'audio' ? 'áudio' : 'vídeo'}`;
  if (state.appInfo?.downloads) {
    destinationPath.textContent = state.kind === 'audio' ? state.appInfo.downloads.audio : state.appInfo.downloads.video;
  } else {
    destinationPath.textContent = `Downloads\\DLPocket\\${prettyKind(state.kind)}`;
  }
}

function validateUrl() {
  const raw = urlInput.value.trim();
  if (!raw) {
    showUrlError('Cole um link para continuar.');
    return false;
  }
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    showUrlError('Digite um link HTTP ou HTTPS válido.');
    return false;
  }
  showUrlError('');
  return true;
}

function showUrlError(message) {
  urlError.textContent = message;
  urlInput.classList.toggle('is-invalid', Boolean(message));
}

function shortUrl(raw) {
  try {
    const parsed = new URL(raw);
    return `${parsed.hostname}${parsed.pathname.length > 1 ? parsed.pathname : ''}`.slice(0, 74);
  } catch {
    return raw.slice(0, 74);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return [hours, minutes, remaining].filter((_, index) => hours || index > 0).map((value) => String(value).padStart(2, '0')).join(':');
}

function codecMatches(vcodec, selected) {
  const value = String(vcodec || '').toLowerCase();
  if (selected === 'auto') return true;
  if (selected === 'h264') return value.startsWith('avc');
  if (selected === 'h265') return /^(hevc|hvc1|hev1)/.test(value);
  if (selected === 'vp9') return value.startsWith('vp9');
  return selected === 'av1' ? value.startsWith('av01') : true;
}

function updateEstimate() {
  if (!state.media) return;
  const maxHeight = qualitySelect.value === 'auto' ? Infinity : Number(qualitySelect.value);
  const maxFps = fpsSelect.value === 'auto' ? Infinity : Number(fpsSelect.value);
  const eligibleVideos = state.media.formats.filter((item) => item.vcodec && item.vcodec !== 'none' && (!item.height || item.height <= maxHeight) && (!item.fps || item.fps <= maxFps));
  const codecVideos = eligibleVideos.filter((item) => codecMatches(item.vcodec, codecSelect.value));
  const videos = codecVideos.length ? codecVideos : eligibleVideos;
  const audios = state.media.formats.filter((item) => item.acodec && item.acodec !== 'none' && (!item.vcodec || item.vcodec === 'none'));
  const videoSize = Math.max(0, ...videos.map((item) => Number(item.filesize) || 0));
  const audioSize = Math.max(0, ...audios.map((item) => Number(item.filesize) || 0));
  const bytes = state.kind === 'audio' ? audioSize : videoSize + audioSize;
  $('#preview-size').textContent = bytes ? `~ ${(bytes / 1048576).toFixed(bytes > 104857600 ? 0 : 1)} MB` : 'Tamanho indisponível';
  const conversion = ['mov', 'avi', 'flv'].includes(formatSelect.value);
  const warning = $('#conversion-warning');
  warning.hidden = !conversion;
  warning.textContent = conversion ? `${formatSelect.value.toUpperCase()} exige conversão pelo FFmpeg e pode usar bastante CPU e levar mais tempo.` : '';
}

async function inspectCurrentUrl() {
  if (!validateUrl()) return;
  mediaPreview.hidden = false;
  $('#preview-title').textContent = 'Carregando informações…';
  $('#preview-details').textContent = '';
  $('#preview-size').textContent = '';
  try {
    const media = await window.dlpocket.inspectMedia(urlInput.value.trim());
    state.media = media;
    $('#preview-title').textContent = media.title;
    $('#preview-details').textContent = [media.uploader, formatDuration(media.duration)].filter(Boolean).join(' • ');
    const thumbnail = $('#preview-thumbnail');
    thumbnail.hidden = !media.thumbnail;
    if (media.thumbnail) thumbnail.src = media.thumbnail;
    updateEstimate();
    renderRealQualities(media.qualityProfiles || []);
    renderPlaylist(media);
  } catch (error) {
    state.media = null;
    $('#preview-title').textContent = error?.message || 'Não foi possível carregar as informações.';
    $('#preview-details').textContent = '';
    $('#preview-size').textContent = '';
  }
}

function renderRealQualities(profiles) {
  const previous = qualitySelect.value;
  qualitySelect.replaceChildren(new Option('Automática (melhor disponível)', 'auto'));
  for (const profile of profiles) {
    const size = profile.filesize ? ` • ~${(profile.filesize / 1048576).toFixed(0)} MB` : '';
    qualitySelect.appendChild(new Option(`${profile.height}p • ${profile.fps || '?'} FPS • ${profile.codec}${size}`, profile.value));
  }
  qualitySelect.value = [...qualitySelect.options].some((option) => option.value === previous) ? previous : 'auto';
}

function renderPlaylist(media) {
  const panel = $('#playlist-panel');
  const container = $('#playlist-items');
  container.replaceChildren();
  panel.hidden = !media.isPlaylist || !media.entries.length;
  if (panel.hidden) return;
  $('#playlist-count').textContent = `${media.entries.length} itens`;
  media.entries.forEach((entry, index) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" checked data-index="${index}"><span></span>`;
    label.querySelector('span').textContent = `${index + 1}. ${entry.title}`;
    for (const [symbol, offset] of [['↑', -1], ['↓', 1]]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'queue-move'; button.textContent = symbol;
      button.disabled = index + offset < 0 || index + offset >= media.entries.length;
      button.addEventListener('click', () => { const target = index + offset; [media.entries[index], media.entries[target]] = [media.entries[target], media.entries[index]]; renderPlaylist(media); });
      label.appendChild(button);
    }
    container.appendChild(label);
  });
}

function updateQueueCount() {
  const count = state.downloads.size;
  queueCount.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
  emptyState.hidden = count > 0;
}

function createDownloadItem(tempId, payload) {
  const fragment = itemTemplate.content.cloneNode(true);
  const root = fragment.querySelector('.download-item');
  const icon = fragment.querySelector('.download-icon');
  const title = fragment.querySelector('.download-title');
  const meta = fragment.querySelector('.download-meta');
  const percent = fragment.querySelector('.download-percent');
  const bar = fragment.querySelector('.progress-bar');
  const status = fragment.querySelector('.download-status');
  const cancel = fragment.querySelector('.cancel-button');

  icon.textContent = payload.kind === 'audio' ? '♪' : '▶';
  title.textContent = payload.title || shortUrl(payload.url);
  meta.textContent = `${prettyKind(payload.kind)} • ${payload.format.toUpperCase()}${payload.kind === 'video' ? ` • ${payload.quality === 'auto' ? 'Auto' : `${payload.quality}p`}` : ''}`;
  cancel.dataset.downloadId = tempId;
  cancel.addEventListener('click', async () => {
    const id = cancel.dataset.downloadId;
    if (!id || id.startsWith('pending-')) return;
    cancel.disabled = true;
    status.textContent = 'Cancelando…';
    await window.dlpocket.cancelDownload(id);
  });

  downloadList.prepend(fragment);
  const inserted = downloadList.firstElementChild;
  return { root: inserted, icon: inserted.querySelector('.download-icon'), title: inserted.querySelector('.download-title'), meta: inserted.querySelector('.download-meta'), percent: inserted.querySelector('.download-percent'), bar: inserted.querySelector('.progress-bar'), status: inserted.querySelector('.download-status'), cancel: inserted.querySelector('.cancel-button') };
}

async function ensureDependencies() {
  if (state.depsReady) return true;
  if (state.preparing) return false;
  setPreparing(true);
  setDependencyBadge('is-working', 'Preparando componentes…');
  setupMessage.textContent = 'Baixando os componentes oficiais necessários. Isso acontece apenas na primeira utilização.';
  try {
    const result = await window.dlpocket.prepareDependencies(false);
    state.depsReady = Boolean(result.ready);
    if (!state.depsReady) throw new Error('Os componentes não ficaram prontos.');
    setDependencyBadge('is-ready', 'Componentes prontos');
    return true;
  } catch (error) {
    setDependencyBadge('is-error', 'Falha na preparação');
    setupPanel.hidden = false;
    setupMessage.textContent = error?.message || 'Não foi possível preparar os componentes.';
    return false;
  } finally {
    setPreparing(false);
  }
}

async function beginDownload() {
  if (!validateUrl()) return;
  const selected = state.media?.isPlaylist
    ? state.media.entries.filter((_, index) => $(`#playlist-items input[data-index="${index}"]`)?.checked)
    : [];
  if (selected.length) {
    const limit = Math.max(1, Math.min(4, Number(state.settings.concurrency) || 1));
    for (let index = 0; index < selected.length; index += limit) {
      await Promise.all(selected.slice(index, index + limit).map((entry) => startSingleDownload({ url: entry.url, title: entry.title })));
    }
    $('#playlist-panel').hidden = true;
    return;
  }
  await startSingleDownload();
}

async function startSingleDownload(source = null) {
  const payload = {
    url: source?.url || urlInput.value.trim(),
    kind: state.kind,
    format: formatSelect.value,
    quality: qualitySelect.value,
    fps: fpsSelect.value,
    codec: codecSelect.value,
    title: source?.title || state.media?.title || null,
    options: {
      cookieBrowser: state.settings.cookieBrowser,
      audioBitrate: $('#audio-bitrate').value,
      audioSampleRate: $('#audio-rate').value,
      audioChannels: $('#audio-channels').value,
      normalizeAudio: $('#audio-normalize').checked,
      subtitleMode: $('#subtitle-mode').value,
      subtitleLanguage: $('#subtitle-language').value,
      subtitleFormat: $('#subtitle-format').value,
      embedThumbnail: $('#embed-thumbnail').checked,
      embedMetadata: $('#embed-metadata').checked,
      preserveChapters: $('#preserve-chapters').checked
    }
  };

  const tempId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ui = createDownloadItem(tempId, payload);
  state.downloads.set(tempId, { payload, ui });
  updateQueueCount();
  downloadButton.disabled = true;

  try {
    if (!(await ensureDependencies())) {
      throw new Error('Não foi possível preparar yt-dlp/FFmpeg.');
    }
    ui.status.textContent = 'Iniciando yt-dlp…';
    const result = await window.dlpocket.startDownload(payload);
    state.downloads.delete(tempId);
    state.downloads.set(result.id, { payload, ui });
    ui.cancel.dataset.downloadId = result.id;
    const pause = document.createElement('button');
    pause.className = 'cancel-button pause-button';
    pause.type = 'button'; pause.textContent = 'Pausar';
    pause.addEventListener('click', async () => { pause.disabled = true; ui.status.textContent = 'Pausando…'; await window.dlpocket.pauseDownload(result.id); });
    ui.cancel.parentElement.insertBefore(pause, ui.cancel);
    urlInput.value = '';
    state.media = null;
    mediaPreview.hidden = true;
    showUrlError('');
    return new Promise((resolve) => state.completionResolvers.set(result.id, resolve));
  } catch (error) {
    ui.root.classList.add('is-error');
    ui.icon.textContent = '!';
    ui.status.textContent = error?.message || 'Falha ao iniciar o download.';
    ui.percent.textContent = 'Erro';
    ui.cancel.hidden = true;
  } finally {
    downloadButton.disabled = state.preparing;
  }
}

function saveHistory(entry) {
  state.history = [entry, ...state.history.filter((item) => item.id !== entry.id)].slice(0, 200);
  window.dlpocket.setHistory(state.history).catch(() => {});
}

const stageLabels = {
  video: 'Baixando vídeo', audio: 'Baixando áudio', merging: 'Mesclando vídeo e áudio',
  converting: 'Convertendo formato', complete: 'Concluído'
};

function handleDownloadEvent(event) {
  const item = state.downloads.get(event.id);
  if (!item) return;
  const { ui } = item;

  if (event.type === 'progress') {
    if (Number.isFinite(event.percent)) {
      const value = Math.max(0, Math.min(100, event.percent));
      ui.bar.style.width = `${value}%`;
      ui.percent.textContent = `${Math.round(value)}%`;
    }
    const parts = [];
    if (event.speed) parts.push(event.speed);
    if (event.eta && event.eta !== 'NA') parts.push(`restam ${event.eta}`);
    ui.status.textContent = `${stageLabels[event.stage] || 'Baixando'}${parts.length ? ` • ${parts.join(' • ')}` : ''}`;
  } else if (event.type === 'stage') {
    if (Number.isFinite(event.percent)) {
      ui.bar.style.width = `${event.percent}%`;
      ui.percent.textContent = `${Math.round(event.percent)}%`;
    }
    ui.status.textContent = stageLabels[event.stage] || 'Processando';
  } else if (event.type === 'status') {
    ui.status.textContent = event.message.replace(/^\[[^\]]+\]\s*/, '').slice(0, 120);
  } else if (event.type === 'complete') {
    ui.root.querySelector('.pause-button')?.remove();
    ui.root.classList.add('is-complete');
    ui.icon.textContent = '✓';
    ui.percent.textContent = '100%';
    ui.bar.style.width = '100%';
    ui.status.textContent = event.file ? `Concluído • ${event.file.split(/[\\/]/).pop()}` : 'Download concluído';
    ui.cancel.textContent = 'Abrir pasta';
    ui.cancel.hidden = false;
    ui.cancel.disabled = false;
    ui.cancel.dataset.downloadId = '';
    ui.cancel.onclick = () => window.dlpocket.openDownloadsFolder(item.payload.kind);
    saveHistory({ id: event.id, ...item.payload, file: event.file || null, completedAt: new Date().toISOString(), status: 'complete' });
    updateHistoryStats();
    if (state.settings.completion === 'folder') window.dlpocket.openDownloadsFolder(item.payload.kind);
  } else if (event.type === 'error') {
    ui.root.querySelector('.pause-button')?.remove();
    ui.root.classList.add('is-error');
    ui.icon.textContent = '!';
    ui.percent.textContent = 'Erro';
    ui.status.textContent = (event.message || 'O download falhou.').split('\n').pop().slice(0, 160);
    ui.cancel.textContent = 'Abrir pasta';
    ui.cancel.disabled = false;
    ui.cancel.dataset.downloadId = '';
    ui.cancel.onclick = () => window.dlpocket.openDownloadsFolder(item.payload.kind);
    saveHistory({ id: event.id, ...item.payload, file: null, completedAt: new Date().toISOString(), status: 'error', error: event.message || null });
  } else if (event.type === 'cancelled') {
    ui.root.classList.add('is-cancelled');
    ui.icon.textContent = '×';
    ui.percent.textContent = '—';
    ui.status.textContent = 'Download cancelado';
    ui.cancel.hidden = true;
  } else if (event.type === 'paused') {
    ui.root.classList.add('is-paused');
    ui.status.textContent = 'Pausado — o arquivo parcial será reutilizado';
    ui.root.querySelector('.pause-button')?.remove();
    ui.cancel.textContent = 'Continuar';
    ui.cancel.disabled = false;
    ui.cancel.dataset.downloadId = '';
    ui.cancel.onclick = () => { ui.root.remove(); state.downloads.delete(event.id); startSingleDownload({ url: item.payload.url, title: item.payload.title }); };
  }
  if (['complete', 'error', 'cancelled', 'paused'].includes(event.type)) {
    state.completionResolvers.get(event.id)?.();
    state.completionResolvers.delete(event.id);
  }
}

function handleDependencyEvent(event) {
  if (event.type === 'stage') {
    setupPanel.hidden = false;
    setupMessage.textContent = event.stage;
    setDependencyBadge('is-working', event.stage);
    setupProgressBar.style.width = '0%';
  } else if (event.type === 'progress') {
    setupPanel.hidden = false;
    setupMessage.textContent = event.percent == null ? event.stage : `${event.stage}: ${event.percent}%`;
    if (event.percent != null) setupProgressBar.style.width = `${event.percent}%`;
  } else if (event.type === 'done') {
    setupProgressBar.style.width = '100%';
    setDependencyBadge('is-ready', 'Componentes prontos');
  }
}

function handleUpdateEvent(event) {
  if (event.type !== 'progress') return;
  updateProgressTrack.hidden = false;
  if (event.percent != null) updateProgressBar.style.width = `${event.percent}%`;
  const size = event.total ? ` de ${(event.total / 1048576).toFixed(1)} MB` : '';
  updateMessage.textContent = `Baixando: ${(event.received / 1048576).toFixed(1)} MB${size}`;
}

function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

const translations = {
  'pt-BR': { paste: 'Colar', download: 'Baixar', settings: 'Configurações', clear: 'Limpar concluídos', link: 'Cole o link do download aqui', newDownload: 'Novo download', session: 'Sessão atual', downloads: 'Downloads', save: 'Salvar', updateComponents: 'Atualizar componentes', heading: 'Cole o link', linkLabel: 'Link do vídeo ou mídia', choose: 'O que deseja baixar?', video: 'Vídeo', audio: 'Áudio', format: 'Formato', quality: 'Qualidade', destination: 'Destino', openFolder: 'Abrir pasta', empty: 'Nenhum download ainda', emptyHelp: 'Seus downloads aparecerão aqui.', theme: 'Tema', language: 'Idioma', defaultQuality: 'Qualidade padrão', defaultFormat: 'Formato padrão', completion: 'Após concluir', automaticUpdates: 'Atualizações automáticas' },
  en: { paste: 'Paste', download: 'Download', settings: 'Settings', clear: 'Clear completed', link: 'Paste the download link here', newDownload: 'New download', session: 'Current session', downloads: 'Downloads', save: 'Save', updateComponents: 'Update components', heading: 'Paste the link', linkLabel: 'Video or media link', choose: 'What do you want to download?', video: 'Video', audio: 'Audio', format: 'Format', quality: 'Quality', destination: 'Destination', openFolder: 'Open folder', empty: 'No downloads yet', emptyHelp: 'Your downloads will appear here.', theme: 'Theme', language: 'Language', defaultQuality: 'Default quality', defaultFormat: 'Default format', completion: 'After completion', automaticUpdates: 'Automatic updates' },
  ru: { paste: 'Вставить', download: 'Скачать', settings: 'Настройки', clear: 'Очистить завершённые', link: 'Вставьте ссылку для скачивания', newDownload: 'Новая загрузка', session: 'Текущая сессия', downloads: 'Загрузки', save: 'Сохранить', updateComponents: 'Обновить компоненты', heading: 'Вставьте ссылку', linkLabel: 'Ссылка на видео или медиа', choose: 'Что вы хотите скачать?', video: 'Видео', audio: 'Аудио', format: 'Формат', quality: 'Качество', destination: 'Папка', openFolder: 'Открыть папку', empty: 'Загрузок пока нет', emptyHelp: 'Ваши загрузки появятся здесь.', theme: 'Тема', language: 'Язык', defaultQuality: 'Качество по умолчанию', defaultFormat: 'Формат по умолчанию', completion: 'После завершения', automaticUpdates: 'Автоматические обновления' },
  es: { paste: 'Pegar', download: 'Descargar', settings: 'Configuración', clear: 'Limpiar completados', link: 'Pegue aquí el enlace de descarga', newDownload: 'Nueva descarga', session: 'Sesión actual', downloads: 'Descargas', save: 'Guardar', updateComponents: 'Actualizar componentes', heading: 'Pegue el enlace', linkLabel: 'Enlace del vídeo o medio', choose: '¿Qué desea descargar?', video: 'Vídeo', audio: 'Audio', format: 'Formato', quality: 'Calidad', destination: 'Destino', openFolder: 'Abrir carpeta', empty: 'Aún no hay descargas', emptyHelp: 'Sus descargas aparecerán aquí.', theme: 'Tema', language: 'Idioma', defaultQuality: 'Calidad predeterminada', defaultFormat: 'Formato predeterminado', completion: 'Al finalizar', automaticUpdates: 'Actualizaciones automáticas' }
};

function resolvedLanguage(language) {
  if (language !== 'system') return language;
  const locale = navigator.language.toLowerCase();
  if (locale.startsWith('ru')) return 'ru';
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('en')) return 'en';
  return 'pt-BR';
}

function applyLanguage(language) {
  const copy = translations[resolvedLanguage(language)] || translations['pt-BR'];
  document.documentElement.lang = resolvedLanguage(language);
  urlInput.placeholder = copy.link;
  $('#paste-button').textContent = copy.paste;
  $('#settings-button').title = copy.settings;
  $('#settings-dialog h2').textContent = copy.settings;
  $('#clear-completed').textContent = copy.clear;
  document.querySelector('.composer .eyebrow').textContent = copy.newDownload;
  document.querySelector('.queue-card .eyebrow').textContent = copy.session;
  $('#queue-heading').textContent = copy.downloads;
  $('#save-settings').textContent = copy.save;
  $('#update-components').textContent = copy.updateComponents;
  $('#download-heading').textContent = copy.heading;
  document.querySelector('label[for="url-input"]').textContent = copy.linkLabel;
  document.querySelector('.choice-group legend').textContent = copy.choose;
  document.querySelectorAll('.segment span:last-child')[0].textContent = copy.video;
  document.querySelectorAll('.segment span:last-child')[1].textContent = copy.audio;
  document.querySelector('label[for="format-select"]').textContent = copy.format;
  document.querySelector('#video-options label:first-child span').textContent = copy.quality;
  $('.destination-label').textContent = copy.destination;
  $('#open-current-folder').textContent = copy.openFolder;
  $('#empty-state strong').textContent = copy.empty;
  $('#empty-state p').textContent = copy.emptyHelp;
  document.querySelector('#setting-theme').previousElementSibling.textContent = copy.theme;
  document.querySelector('#setting-language').previousElementSibling.textContent = copy.language;
  document.querySelector('#setting-quality').previousElementSibling.textContent = copy.defaultQuality;
  document.querySelector('#setting-format').previousElementSibling.textContent = copy.defaultFormat;
  document.querySelector('#setting-completion').previousElementSibling.textContent = copy.completion;
  document.querySelector('.check-setting span').textContent = copy.automaticUpdates;
  updateComposerCopy();
}

async function loadPreferences() {
  const [settings, history] = await Promise.all([window.dlpocket.getSettings(), window.dlpocket.getHistory()]);
  state.settings = { ...state.settings, ...settings };
  state.history = Array.isArray(history) ? history : [];
  applyTheme(state.settings.theme);
  applyLanguage(state.settings.language);
  qualitySelect.value = state.settings.quality;
}

function restoreHistory() {
  for (const entry of state.history.slice().reverse()) {
    const ui = createDownloadItem(entry.id, entry);
    ui.root.classList.add(entry.status === 'error' ? 'is-error' : 'is-complete', 'is-history');
    ui.icon.textContent = entry.status === 'error' ? '!' : '✓';
    ui.percent.textContent = entry.status === 'error' ? 'Erro' : '100%';
    ui.bar.style.width = entry.status === 'error' ? '18%' : '100%';
    ui.status.textContent = entry.status === 'error' ? (entry.error || 'Falha no download') : new Date(entry.completedAt).toLocaleString();
    ui.cancel.textContent = entry.file ? 'Abrir arquivo' : 'Abrir pasta';
    ui.cancel.dataset.downloadId = '';
    ui.cancel.onclick = () => entry.file ? window.dlpocket.openHistoryFile(entry.file) : window.dlpocket.openDownloadsFolder(entry.kind);
    const actions = ui.cancel.parentElement;
    const addAction = (label, handler) => { const button = document.createElement('button'); button.className = 'cancel-button'; button.type = 'button'; button.textContent = label; button.addEventListener('click', handler); actions.appendChild(button); };
    addAction('Copiar link', () => window.dlpocket.writeClipboard(entry.url));
    addAction('Baixar novamente', () => startSingleDownload({ url: entry.url, title: entry.title }));
    addAction('Remover', async () => {
      if (entry.file && confirm('Deseja apagar também o arquivo baixado?')) await window.dlpocket.deleteHistoryFile(entry.file).catch(() => {});
      state.history = state.history.filter((item) => item.id !== entry.id);
      state.downloads.delete(entry.id); ui.root.remove(); await window.dlpocket.setHistory(state.history); updateQueueCount(); updateHistoryStats();
    });
    state.downloads.set(entry.id, { payload: entry, ui, history: true });
  }
  updateQueueCount();
  updateHistoryStats();
}

async function updateHistoryStats() {
  const stats = await window.dlpocket.getHistoryStats().catch(() => ({ count: 0, bytes: 0 }));
  $('#history-stats').textContent = `${stats.count} registros • ${(stats.bytes / 1048576).toFixed(stats.bytes > 104857600 ? 0 : 1)} MB`;
}

async function refreshComponentVersion(auto = false) {
  try {
    const result = auto ? await window.dlpocket.updateYtDlp(false) : await window.dlpocket.getComponentVersions();
    $('#yt-dlp-version').textContent = result.ytDlpVersion ? `v${result.ytDlpVersion}` : 'Não instalado';
    if (auto) {
      state.settings.lastComponentCheck = Date.now();
      window.dlpocket.setSettings(state.settings).catch(() => {});
    }
  } catch (error) {
    $('#yt-dlp-version').textContent = error?.message || 'Indisponível';
  }
}

async function checkForUpdates() {
  try {
    const release = await window.dlpocket.checkForUpdates({ channel: state.settings.updateChannel });
    if (!release.available) return;
    if (state.settings.ignoredVersion === release.version) return;
    state.update = release;
    updateTitle.textContent = `DLPocket v${release.version} disponível`;
    const notes = String(release.notes || '').replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220);
    updateMessage.textContent = notes || `Você está usando a v${release.currentVersion}. Deseja baixar a nova versão?`;
    updateDismiss.textContent = `Ignorar v${release.version}`;
    updateCard.hidden = false;
    if (state.settings.silentUpdate) downloadAvailableUpdate();
  } catch {
    // A verificação é silenciosa para não interromper o uso offline.
  }
}

async function downloadAvailableUpdate() {
  if (state.updateFile) {
    updateMessage.textContent = 'Preparando instalação…';
    updateProgressBar.style.width = '100%';
    await window.dlpocket.restartAndUpdate(state.updateFile);
    return;
  }
  if (!state.update) return;
  updateDownload.disabled = true;
  updateDismiss.hidden = true;
  updateDownload.textContent = 'Baixando…';
  updateProgressTrack.hidden = false;
  try {
    const result = await window.dlpocket.downloadUpdate(state.update);
    state.updateFile = result.filePath;
    updateProgressBar.style.width = '100%';
    updateTitle.textContent = 'Atualização pronta';
    updateMessage.textContent = 'Download verificado. Abra o instalador para concluir a atualização.';
    updateDownload.textContent = 'Reiniciar e atualizar';
    updateDownload.disabled = false;
    updateDismiss.hidden = false;
    updateDismiss.textContent = 'Instalar ao fechar';
  } catch (error) {
    updateTitle.textContent = 'Falha na atualização';
    updateMessage.textContent = error?.message || 'Não foi possível baixar a nova versão.';
    updateDownload.textContent = 'Tentar novamente';
    updateDownload.disabled = false;
    updateDismiss.hidden = false;
  }
}

async function init() {
  window.dlpocket.onDownloadEvent(handleDownloadEvent);
  window.dlpocket.onDependencyEvent(handleDependencyEvent);
  window.dlpocket.onUpdateEvent(handleUpdateEvent);

  await loadPreferences();
  state.appInfo = await window.dlpocket.getAppInfo();
  $('#app-version').textContent = `DLPocket v${state.appInfo.version}`;
  updateComposerCopy();

  try {
    const deps = await window.dlpocket.getDependencyStatus();
    state.depsReady = Boolean(deps.ready);
    setDependencyBadge(state.depsReady ? 'is-ready' : 'is-checking', state.depsReady ? 'Componentes prontos' : 'Preparação necessária');
  } catch {
    setDependencyBadge('is-error', 'Status indisponível');
  }
  restoreHistory();
  const componentCheckDue = !state.settings.lastComponentCheck || Date.now() - state.settings.lastComponentCheck > 24 * 60 * 60 * 1000;
  refreshComponentVersion(state.settings.autoUpdates && componentCheckDue);
  if (state.settings.autoUpdates) setTimeout(checkForUpdates, 1200);
}

document.querySelectorAll('input[name="kind"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.kind = input.value;
    document.querySelectorAll('.segment').forEach((segment) => segment.classList.toggle('is-selected', segment.contains(input)));
    renderFormats();
  });
});

formatSelect.addEventListener('change', updateComposerCopy);
urlInput.addEventListener('input', () => {
  showUrlError('');
  state.media = null;
  mediaPreview.hidden = true;
  clearTimeout(inspectTimer);
  if (/^https?:\/\//i.test(urlInput.value.trim())) inspectTimer = setTimeout(inspectCurrentUrl, 650);
});
urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') beginDownload();
});
$('#paste-button').addEventListener('click', async () => {
  try {
    const text = await window.dlpocket.readClipboard();
    urlInput.value = text.trim();
    showUrlError('');
    urlInput.focus();
    if (/^https?:\/\//i.test(urlInput.value)) inspectCurrentUrl();
  } catch {
    showUrlError('Não foi possível ler a área de transferência. Use Ctrl+V.');
  }
});
downloadButton.addEventListener('click', beginDownload);
$('#open-base-folder').addEventListener('click', () => window.dlpocket.openDownloadsFolder('base'));
$('#open-current-folder').addEventListener('click', () => window.dlpocket.openDownloadsFolder(selectedFolderKind()));
$('#yt-dlp-link').addEventListener('click', () => window.dlpocket.openYtDlpRepository());
updateDownload.addEventListener('click', downloadAvailableUpdate);
updateDismiss.addEventListener('click', async () => {
  if (state.updateFile) {
    await window.dlpocket.installUpdateOnQuit(state.updateFile);
    updateDismiss.textContent = 'Instalação agendada';
    updateDismiss.disabled = true;
  } else {
    if (state.update?.version) {
      state.settings.ignoredVersion = state.update.version;
      await window.dlpocket.setSettings(state.settings);
    }
    updateCard.hidden = true;
  }
});
qualitySelect.addEventListener('change', updateEstimate);
fpsSelect.addEventListener('change', updateEstimate);
codecSelect.addEventListener('change', updateEstimate);
formatSelect.addEventListener('change', updateEstimate);
$('#playlist-toggle-all').addEventListener('click', () => {
  const inputs = [...document.querySelectorAll('#playlist-items input')];
  const select = inputs.some((input) => !input.checked);
  inputs.forEach((input) => { input.checked = select; });
  $('#playlist-toggle-all').textContent = select ? 'Desmarcar todos' : 'Selecionar todos';
});
document.querySelectorAll('input[name="kind"]').forEach((input) => input.addEventListener('change', () => {
  document.querySelectorAll('.audio-option').forEach((element) => { element.hidden = input.value !== 'audio'; });
}));
$('#cancel-all').addEventListener('click', () => {
  for (const [id, item] of state.downloads) if (!item.history && !id.startsWith('pending-')) window.dlpocket.cancelDownload(id);
});
function filterHistory() {
  const query = $('#history-search').value.trim().toLowerCase();
  const filter = $('#history-filter').value;
  for (const item of state.downloads.values()) {
    if (!item.history) continue;
    const matchesText = !query || `${item.payload.title || ''} ${item.payload.url || ''}`.toLowerCase().includes(query);
    const matchesFilter = filter === 'all' || item.payload.kind === filter || item.payload.status === filter;
    item.ui.root.hidden = !(matchesText && matchesFilter);
  }
}
$('#history-search').addEventListener('input', filterHistory);
$('#history-filter').addEventListener('change', filterHistory);
$('#settings-button').addEventListener('click', async () => {
  $('#setting-theme').value = state.settings.theme;
  $('#setting-language').value = state.settings.language;
  $('#setting-quality').value = state.settings.quality;
  $('#setting-format').value = state.settings.format;
  $('#setting-completion').value = state.settings.completion;
  $('#setting-cookies').value = state.settings.cookieBrowser || 'none';
  $('#setting-concurrency').value = String(state.settings.concurrency || 2);
  $('#setting-update-channel').value = state.settings.updateChannel || 'stable';
  $('#setting-auto-updates').checked = state.settings.autoUpdates;
  $('#setting-silent-update').checked = Boolean(state.settings.silentUpdate);
  settingsDialog.showModal();
  refreshComponentVersion(false);
});
$('#save-settings').addEventListener('click', async (event) => {
  event.preventDefault();
  state.settings = {
    ...state.settings,
    theme: $('#setting-theme').value,
    language: $('#setting-language').value,
    quality: $('#setting-quality').value,
    format: $('#setting-format').value,
    completion: $('#setting-completion').value,
    cookieBrowser: $('#setting-cookies').value,
    concurrency: Number($('#setting-concurrency').value),
    updateChannel: $('#setting-update-channel').value,
    silentUpdate: $('#setting-silent-update').checked,
    autoUpdates: $('#setting-auto-updates').checked
  };
  await window.dlpocket.setSettings(state.settings);
  applyTheme(state.settings.theme);
  applyLanguage(state.settings.language);
  qualitySelect.value = state.settings.quality;
  if (formats[state.kind].some(([value]) => value === state.settings.format)) {
    formatSelect.value = state.settings.format;
    updateComposerCopy();
  }
  settingsDialog.close();
});
$('#update-components').addEventListener('click', async (event) => {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Atualizando…';
  await refreshComponentVersion(true);
  button.disabled = false;
  applyLanguage(state.settings.language);
});
$('#diagnostics-button').addEventListener('click', async (event) => {
  event.preventDefault();
  const info = await window.dlpocket.getDiagnostics();
  const summary = `DLPocket ${info.appVersion}\nElectron ${info.electron}\nNode ${info.node}\nyt-dlp ${info.ytDlp || 'indisponível'}\n${info.ffmpeg || 'FFmpeg indisponível'}\nEspaço livre: ${info.freeDiskBytes ? (info.freeDiskBytes / 1073741824).toFixed(1) + ' GB' : 'indisponível'}\nGitHub: ${info.githubConnection ? 'conectado' : 'sem conexão'}\n\nExportar relatório sem dados pessoais?`;
  if (confirm(summary)) await window.dlpocket.exportDiagnostics();
  if (confirm('Deseja reparar yt-dlp, FFmpeg e FFprobe agora?')) await window.dlpocket.repairComponents();
});
$('#clear-completed').addEventListener('click', () => {
  for (const [id, item] of state.downloads) {
    if (item.ui.root.classList.contains('is-complete')) {
      item.ui.root.remove();
      state.downloads.delete(id);
    }
  }
  state.history = [];
  window.dlpocket.setHistory([]).catch(() => {});
  updateQueueCount();
});

init();
