'use strict';

const CODEC_FILTERS = {
  auto: '', h264: '[vcodec^=avc]', h265: '[vcodec~=(?i)^(hevc|hvc1|hev1)]',
  vp9: '[vcodec^=vp9]', av1: '[vcodec^=av01]'
};

function buildVideoSelector(quality = 'auto', fps = 'auto', codec = 'auto') {
  const heightFilter = quality === 'auto' ? '' : `[height<=${quality}]`;
  const fpsFilter = fps === 'auto' ? '' : `[fps<=${fps}]`;
  const preferred = `bv*${heightFilter}${fpsFilter}${CODEC_FILTERS[codec] || ''}+ba`;
  return `${preferred}/bv*${heightFilter}${fpsFilter}+ba/b${heightFilter}${fpsFilter}`;
}

function codecName(value) {
  const codec = String(value || '').toLowerCase();
  if (codec.startsWith('avc')) return 'H.264';
  if (/^(hevc|hvc1|hev1)/.test(codec)) return 'H.265';
  if (codec.startsWith('vp9')) return 'VP9';
  if (codec.startsWith('av01')) return 'AV1';
  return codec && codec !== 'none' ? codec.toUpperCase() : '—';
}

function qualityProfiles(formats = []) {
  const groups = new Map();
  for (const format of formats) {
    if (!format.height || !format.vcodec || format.vcodec === 'none') continue;
    const key = String(format.height);
    const size = Number(format.filesize) || 0;
    const current = groups.get(key);
    if (!current || size > (current.filesize || 0) || Number(format.fps) > Number(current.fps)) groups.set(key, { ...format, height: Number(format.height) });
  }
  return [...groups.values()].sort((a, b) => b.height - a.height).map((format) => ({
    value: String(format.height), height: format.height, fps: Number(format.fps) || null,
    codec: codecName(format.vcodec), filesize: Number(format.filesize) || null
  }));
}

function overallProgress(kind, pass, raw) {
  const percent = Math.max(0, Math.min(100, Number(raw) || 0));
  if (kind === 'audio') return percent * .9;
  return pass === 0 ? percent * .75 : 75 + percent * .15;
}

module.exports = { buildVideoSelector, codecName, qualityProfiles, overallProgress };
