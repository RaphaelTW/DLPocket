const state = {
  appInfo: null,
  depsReady: false,
  preparing: false,
  kind: 'video',
  format: 'mp4',
  downloads: new Map(),
  update: null,
  updateFile: null
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
  state.format = formats[state.kind][0][0];
  updateComposerCopy();
}

function updateComposerCopy() {
  state.format = formatSelect.value;
  downloadButtonText.textContent = `Baixar ${state.kind === 'audio' ? 'áudio' : 'vídeo'}`;
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
  title.textContent = shortUrl(payload.url);
  meta.textContent = `${prettyKind(payload.kind)} • ${payload.format.toUpperCase()}`;
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
  const payload = {
    url: urlInput.value.trim(),
    kind: state.kind,
    format: formatSelect.value
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
    urlInput.value = '';
    showUrlError('');
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
    ui.status.textContent = parts.join(' • ') || 'Baixando…';
  } else if (event.type === 'status') {
    ui.status.textContent = event.message.replace(/^\[[^\]]+\]\s*/, '').slice(0, 120);
  } else if (event.type === 'complete') {
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
  } else if (event.type === 'error') {
    ui.root.classList.add('is-error');
    ui.icon.textContent = '!';
    ui.percent.textContent = 'Erro';
    ui.status.textContent = (event.message || 'O download falhou.').split('\n').pop().slice(0, 160);
    ui.cancel.textContent = 'Abrir pasta';
    ui.cancel.disabled = false;
    ui.cancel.dataset.downloadId = '';
    ui.cancel.onclick = () => window.dlpocket.openDownloadsFolder(item.payload.kind);
  } else if (event.type === 'cancelled') {
    ui.root.classList.add('is-cancelled');
    ui.icon.textContent = '×';
    ui.percent.textContent = '—';
    ui.status.textContent = 'Download cancelado';
    ui.cancel.hidden = true;
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

async function checkForUpdates() {
  try {
    const release = await window.dlpocket.checkForUpdates();
    if (!release.available) return;
    state.update = release;
    updateTitle.textContent = `DLPocket v${release.version} disponível`;
    updateMessage.textContent = `Você está usando a v${release.currentVersion}. Deseja baixar a nova versão?`;
    updateCard.hidden = false;
  } catch {
    // A verificação é silenciosa para não interromper o uso offline.
  }
}

async function downloadAvailableUpdate() {
  if (state.updateFile) {
    await window.dlpocket.openUpdate(state.updateFile);
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
    updateDownload.textContent = 'Abrir instalador';
    updateDownload.disabled = false;
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
  setTimeout(checkForUpdates, 1200);
}

document.querySelectorAll('input[name="kind"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.kind = input.value;
    document.querySelectorAll('.segment').forEach((segment) => segment.classList.toggle('is-selected', segment.contains(input)));
    renderFormats();
  });
});

formatSelect.addEventListener('change', updateComposerCopy);
urlInput.addEventListener('input', () => showUrlError(''));
urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') beginDownload();
});
$('#paste-button').addEventListener('click', async () => {
  try {
    const text = await window.dlpocket.readClipboard();
    urlInput.value = text.trim();
    showUrlError('');
    urlInput.focus();
  } catch {
    showUrlError('Não foi possível ler a área de transferência. Use Ctrl+V.');
  }
});
downloadButton.addEventListener('click', beginDownload);
$('#open-base-folder').addEventListener('click', () => window.dlpocket.openDownloadsFolder('base'));
$('#open-current-folder').addEventListener('click', () => window.dlpocket.openDownloadsFolder(selectedFolderKind()));
$('#yt-dlp-link').addEventListener('click', () => window.dlpocket.openYtDlpRepository());
updateDownload.addEventListener('click', downloadAvailableUpdate);
updateDismiss.addEventListener('click', () => { updateCard.hidden = true; });

init();
