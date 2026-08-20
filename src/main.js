const { app, BrowserWindow, ipcMain, shell, session, net, clipboard, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const readline = require('node:readline');
const crypto = require('node:crypto');

const APP_NAME = 'DLPocket';
const PROJECT_FOLDER = 'DLPocket';
const RELEASES_API = 'https://api.github.com/repos/RaphaelTW/DLPocket/releases/latest';
const activeDownloads = new Map();
let mainWindow = null;
let preparingDependencies = null;

const DOWNLOAD_SOURCES = {
  ytDlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  ytDlpChecksums: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS',
  ffmpeg: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip',
  ffmpegChecksums: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/checksums.sha256'
};

function getBinDir() {
  return path.join(app.getPath('userData'), 'bin');
}

function getDependencyPaths() {
  const binDir = getBinDir();
  return {
    binDir,
    ytDlp: path.join(binDir, 'yt-dlp.exe'),
    ffmpeg: path.join(binDir, 'ffmpeg.exe'),
    ffprobe: path.join(binDir, 'ffprobe.exe')
  };
}

function getDownloadDirs() {
  const base = path.join(app.getPath('downloads'), PROJECT_FOLDER);
  return {
    base,
    video: path.join(base, 'Vídeo'),
    audio: path.join(base, 'Áudio'),
    updates: path.join(base, 'Atualizações')
  };
}

function compareVersions(left, right) {
  const normalize = (value) => String(value).replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const a = normalize(left);
  const b = normalize(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}

async function checkForUpdates() {
  const response = await net.fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `${APP_NAME}/${app.getVersion()}` }
  });
  if (!response.ok) throw new Error(`Não foi possível verificar atualizações (HTTP ${response.status}).`);
  const release = await response.json();
  const version = String(release.tag_name || '').replace(/^v/i, '');
  const installer = release.assets?.find((asset) => /^DLPocket-Setup-.*\.exe$/i.test(asset.name));
  const checksums = release.assets?.find((asset) => asset.name === 'SHA256SUMS.txt');
  if (!version || !installer || !checksums) return { available: false, currentVersion: app.getVersion() };
  return {
    available: compareVersions(version, app.getVersion()) > 0,
    currentVersion: app.getVersion(), version, name: installer.name,
    downloadUrl: installer.browser_download_url,
    checksumUrl: checksums.browser_download_url,
    releaseUrl: release.html_url
  };
}

async function downloadUpdate(_event, release) {
  if (!release || typeof release !== 'object') throw new Error('Atualização inválida.');
  const downloadUrl = new URL(release.downloadUrl);
  const checksumUrl = new URL(release.checksumUrl);
  if (downloadUrl.protocol !== 'https:' || checksumUrl.protocol !== 'https:' || downloadUrl.hostname !== 'github.com' || checksumUrl.hostname !== 'github.com') {
    throw new Error('Origem da atualização não autorizada.');
  }
  const filename = path.basename(String(release.name || ''));
  if (!/^DLPocket-Setup-[0-9.]+\.exe$/i.test(filename)) throw new Error('Nome do instalador inválido.');
  const dirs = getDownloadDirs();
  await fsp.mkdir(dirs.updates, { recursive: true });
  const destination = path.join(dirs.updates, filename);
  const checksumText = await fetchText(checksumUrl.toString(), 'checksum da atualização');
  const expected = parseExpectedSha256(checksumText, filename);
  const partial = `${destination}.part`;
  await fsp.rm(partial, { force: true });
  const response = await net.fetch(downloadUrl.toString(), { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Falha ao baixar a atualização (HTTP ${response.status}).`);
  const total = Number(response.headers.get('content-length') || 0);
  let received = 0;
  const source = Readable.fromWeb(response.body);
  source.on('data', (chunk) => {
    received += chunk.length;
    sendToRenderer('update:event', { type: 'progress', received, total, percent: total ? Math.round((received / total) * 100) : null });
  });
  await pipeline(source, fs.createWriteStream(partial));
  const actual = await sha256File(partial);
  if (actual !== expected) {
    await fsp.rm(partial, { force: true });
    throw new Error('A verificação SHA-256 da atualização falhou.');
  }
  await fsp.rm(destination, { force: true });
  await fsp.rename(partial, destination);
  sendToRenderer('update:event', { type: 'complete', filePath: destination });
  return { filePath: destination };
}

async function ensureDownloadDirs() {
  const dirs = getDownloadDirs();
  await Promise.all([
    fsp.mkdir(dirs.video, { recursive: true }),
    fsp.mkdir(dirs.audio, { recursive: true })
  ]);
  return dirs;
}

function isTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || '';
  return senderUrl.startsWith('file://');
}

function safeHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origem IPC não autorizada.');
    }
    return handler(event, ...args);
  });
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function dependencyStatus() {
  const deps = getDependencyPaths();
  const [ytDlp, ffmpeg, ffprobe] = await Promise.all([
    fsp.access(deps.ytDlp).then(() => true).catch(() => false),
    fsp.access(deps.ffmpeg).then(() => true).catch(() => false),
    fsp.access(deps.ffprobe).then(() => true).catch(() => false)
  ]);

  return {
    ready: ytDlp && ffmpeg && ffprobe,
    ytDlp,
    ffmpeg,
    ffprobe,
    binDir: deps.binDir
  };
}

async function fetchText(url, label) {
  const response = await net.fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Falha ao obter ${label} (HTTP ${response.status}).`);
  }
  return response.text();
}

function parseExpectedSha256(checksumText, filename) {
  for (const rawLine of checksumText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([a-fA-F0-9]{64})\s+[*]?(.+)$/);
    if (!match) continue;
    const listedName = match[2].trim().replaceAll('\\', '/').split('/').pop();
    if (listedName.toLowerCase() === filename.toLowerCase()) return match[1].toLowerCase();
  }
  throw new Error(`Checksum SHA-256 de ${filename} não encontrado.`);
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function downloadVerifiedFile(url, destination, stageLabel, checksumUrl, checksumFilename) {
  const checksumText = await fetchText(checksumUrl, `checksums de ${stageLabel}`);
  const expected = parseExpectedSha256(checksumText, checksumFilename);
  await downloadFile(url, destination, stageLabel);
  sendToRenderer('deps:event', { type: 'stage', stage: `Verificando ${stageLabel}` });
  const actual = await sha256File(destination);
  if (actual !== expected) {
    await fsp.rm(destination, { force: true });
    throw new Error(`A verificação de integridade de ${stageLabel} falhou. Tente novamente.`);
  }
}

async function downloadFile(url, destination, stageLabel) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  await fsp.rm(partial, { force: true });

  const response = await net.fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${stageLabel} (HTTP ${response.status}).`);
  }

  const total = Number(response.headers.get('content-length') || 0);
  let received = 0;
  const source = Readable.fromWeb(response.body);
  source.on('data', (chunk) => {
    received += chunk.length;
    const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null;
    sendToRenderer('deps:event', {
      type: 'progress',
      stage: stageLabel,
      percent,
      received,
      total
    });
  });

  await pipeline(source, fs.createWriteStream(partial));
  await fsp.rm(destination, { force: true });
  await fsp.rename(partial, destination);
}

function spawnAndWait(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr.trim() || `${command} encerrou com código ${code}.`));
    });
  });
}

async function findFileRecursive(root, filename) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.name.toLowerCase() === filename.toLowerCase()) return fullPath;
    }
  }
  return null;
}

async function extractZip(zipPath, destination) {
  await fsp.rm(destination, { recursive: true, force: true });
  await fsp.mkdir(destination, { recursive: true });

  try {
    await spawnAndWait('tar.exe', ['-xf', zipPath, '-C', destination]);
    return;
  } catch (_) {
    const escapedZip = zipPath.replaceAll("'", "''");
    const escapedDestination = destination.replaceAll("'", "''");
    const command = `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`;
    await spawnAndWait('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
  }
}

async function installFfmpeg(deps, tempDir) {
  const ffmpegZip = path.join(tempDir, 'ffmpeg.zip');
  const extractDir = path.join(tempDir, 'ffmpeg-extracted');
  sendToRenderer('deps:event', { type: 'stage', stage: 'Baixando FFmpeg' });
  await downloadVerifiedFile(
    DOWNLOAD_SOURCES.ffmpeg,
    ffmpegZip,
    'FFmpeg',
    DOWNLOAD_SOURCES.ffmpegChecksums,
    'ffmpeg-master-latest-win64-gpl.zip'
  );

  sendToRenderer('deps:event', { type: 'stage', stage: 'Preparando FFmpeg' });
  await extractZip(ffmpegZip, extractDir);
  const ffmpegSource = await findFileRecursive(extractDir, 'ffmpeg.exe');
  const ffprobeSource = await findFileRecursive(extractDir, 'ffprobe.exe');
  if (!ffmpegSource || !ffprobeSource) {
    throw new Error('Não foi possível localizar ffmpeg.exe/ffprobe.exe no pacote baixado.');
  }

  await Promise.all([
    fsp.copyFile(ffmpegSource, deps.ffmpeg),
    fsp.copyFile(ffprobeSource, deps.ffprobe)
  ]);
}

async function prepareDependencies(force = false) {
  if (process.platform !== 'win32') {
    throw new Error('A versão 1.0.0 do DLPocket é preparada para Windows 10/11 x64.');
  }

  if (preparingDependencies) return preparingDependencies;

  preparingDependencies = (async () => {
    const deps = getDependencyPaths();
    await fsp.mkdir(deps.binDir, { recursive: true });
    const before = await dependencyStatus();
    if (before.ready && !force) return before;

    const tempDir = path.join(app.getPath('temp'), `dlpocket-${crypto.randomUUID()}`);
    await fsp.mkdir(tempDir, { recursive: true });

    try {
      if (force || !before.ytDlp) {
        sendToRenderer('deps:event', { type: 'stage', stage: 'Baixando yt-dlp' });
        await downloadVerifiedFile(
          DOWNLOAD_SOURCES.ytDlp,
          deps.ytDlp,
          'yt-dlp',
          DOWNLOAD_SOURCES.ytDlpChecksums,
          'yt-dlp.exe'
        );
      }
      if (force || !before.ffmpeg || !before.ffprobe) {
        await installFfmpeg(deps, tempDir);
      }
      sendToRenderer('deps:event', { type: 'done', stage: 'Componentes prontos' });
      return dependencyStatus();
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  })();

  try {
    return await preparingDependencies;
  } finally {
    preparingDependencies = null;
  }
}

function validateUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 4096) {
    throw new Error('Link inválido.');
  }
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('Digite um link válido.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Apenas links HTTP/HTTPS são permitidos.');
  }
  return parsed.toString();
}

const FORMAT_ALLOWLIST = {
  video: new Set(['mp4', 'mkv', 'webm']),
  audio: new Set(['mp3', 'm4a', 'wav', 'flac', 'opus'])
};

function buildYtDlpArgs({ url, kind, format, targetDir, deps }) {
  const args = [
    '--no-colors',
    '--newline',
    '--progress',
    '--progress-delta', '0.2',
    '--no-playlist',
    '--windows-filenames',
    '--trim-filenames', '180',
    '--ffmpeg-location', deps.binDir,
    '--js-runtimes', `node:${process.execPath}`,
    '--progress-template', 'download:__DLPOCKET_PROGRESS__:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--print', 'after_move:__DLPOCKET_FILE__:%(filepath)s',
    '-P', targetDir,
    '-o', '%(title).180B [%(id)s].%(ext)s'
  ];

  if (kind === 'audio') {
    args.push('-x', '--audio-format', format, '--audio-quality', '0');
  } else if (format === 'mp4') {
    args.push(
      '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      '--merge-output-format', 'mp4',
      '--remux-video', 'mp4'
    );
  } else if (format === 'webm') {
    args.push(
      '-f', 'bv*[ext=webm]+ba[ext=webm]/b[ext=webm]/bv*+ba/b',
      '--merge-output-format', 'webm',
      '--remux-video', 'webm'
    );
  } else {
    args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mkv', '--remux-video', 'mkv');
  }

  args.push(url);
  return args;
}

function cleanOutputLine(line) {
  return line.replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, '').trim();
}

async function startDownload(event, payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dados de download inválidos.');
  const kind = payload.kind === 'audio' ? 'audio' : payload.kind === 'video' ? 'video' : null;
  const format = typeof payload.format === 'string' ? payload.format.toLowerCase() : '';
  if (!kind || !FORMAT_ALLOWLIST[kind].has(format)) throw new Error('Formato não permitido.');
  const url = validateUrl(payload.url);

  const depsStatus = await prepareDependencies(false);
  if (!depsStatus.ready) throw new Error('Os componentes necessários não estão prontos.');
  const deps = getDependencyPaths();
  const dirs = await ensureDownloadDirs();
  const targetDir = kind === 'video' ? dirs.video : dirs.audio;
  const id = crypto.randomUUID();
  const args = buildYtDlpArgs({ url, kind, format, targetDir, deps });

  const child = spawn(deps.ytDlp, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1'
    }
  });

  activeDownloads.set(id, { child, startedAt: Date.now(), targetDir });
  const sender = event.sender;
  const emit = (payloadEvent) => {
    if (!sender.isDestroyed()) sender.send('download:event', { id, ...payloadEvent });
  };

  emit({ type: 'started', kind, format, targetDir });

  let stderrTail = '';
  let outputFile = null;
  const consume = (chunk, isError = false) => {
    const text = chunk.toString('utf8');
    if (isError) stderrTail = (stderrTail + text).slice(-12000);
    for (const rawLine of text.split(/\r?\n/)) {
      const line = cleanOutputLine(rawLine);
      if (!line) continue;
      if (line.startsWith('__DLPOCKET_PROGRESS__:')) {
        const data = line.slice('__DLPOCKET_PROGRESS__:'.length).split('|');
        const percent = Number.parseFloat((data[0] || '').replace('%', '').trim());
        emit({
          type: 'progress',
          percent: Number.isFinite(percent) ? percent : null,
          speed: (data[1] || '').trim() || null,
          eta: (data[2] || '').trim() || null
        });
      } else if (line.startsWith('__DLPOCKET_FILE__:')) {
        outputFile = line.slice('__DLPOCKET_FILE__:'.length).trim();
      } else if (line.startsWith('[download]') || line.startsWith('[ExtractAudio]') || line.startsWith('[Merger]') || line.startsWith('[VideoConvertor]')) {
        emit({ type: 'status', message: line.slice(0, 220) });
      }
    }
  };

  readline.createInterface({ input: child.stdout }).on('line', (line) => consume(`${line}\n`, false));
  readline.createInterface({ input: child.stderr }).on('line', (line) => consume(`${line}\n`, true));
  child.on('error', (error) => {
    activeDownloads.delete(id);
    emit({ type: 'error', message: error.message });
  });
  child.on('close', (code, signal) => {
    activeDownloads.delete(id);
    if (signal || code === null) {
      emit({ type: 'cancelled' });
      return;
    }
    if (code === 0) {
      emit({ type: 'complete', file: outputFile, targetDir });
    } else {
      const usefulError = stderrTail
        .split(/\r?\n/)
        .map(cleanOutputLine)
        .filter(Boolean)
        .slice(-5)
        .join('\n');
      emit({ type: 'error', message: usefulError || `yt-dlp encerrou com código ${code}.` });
    }
  });

  return { id, targetDir };
}

async function cancelDownload(_event, id) {
  if (typeof id !== 'string') return false;
  const active = activeDownloads.get(id);
  if (!active) return false;

  const pid = active.child.pid;
  if (process.platform === 'win32' && pid) {
    spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    active.child.kill('SIGTERM');
  }
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    minHeight: 620,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111317' : '#f5f6f8',
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged && process.env.DLPOCKET_PORTABLE !== '1'
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  safeHandle('app:info', async () => {
    const dirs = await ensureDownloadDirs();
    return {
      name: APP_NAME,
      version: app.getVersion(),
      downloads: dirs,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron
    };
  });
  safeHandle('clipboard:read', () => clipboard.readText());
  safeHandle('deps:status', () => dependencyStatus());
  safeHandle('deps:prepare', (_event, force) => prepareDependencies(Boolean(force)));
  safeHandle('download:start', startDownload);
  safeHandle('download:cancel', cancelDownload);
  safeHandle('update:check', checkForUpdates);
  safeHandle('update:download', downloadUpdate);
  safeHandle('update:open', async (_event, filePath) => {
    const dirs = getDownloadDirs();
    const resolved = path.resolve(String(filePath || ''));
    if (path.dirname(resolved) !== path.resolve(dirs.updates) || path.extname(resolved).toLowerCase() !== '.exe') {
      throw new Error('Arquivo de atualização inválido.');
    }
    const result = await shell.openPath(resolved);
    return result || null;
  });
  safeHandle('folder:open', async (_event, kind) => {
    const dirs = await ensureDownloadDirs();
    const target = kind === 'video' ? dirs.video : kind === 'audio' ? dirs.audio : dirs.base;
    const result = await shell.openPath(target);
    return result || null;
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  for (const { child } of activeDownloads.values()) {
    try { child.kill(); } catch (_) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
