'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

test('explicit light and dark themes have dedicated tokens', () => {
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /#3584e4/i);
});

test('layout includes responsive breakpoints and reduced motion', () => {
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('advanced controls remain represented in the renderer', () => {
  for (const id of ['quality-select', 'playlist-panel', 'audio-bitrate', 'subtitle-mode', 'history-search', 'setting-cookies']) assert.match(html, new RegExp(`id="${id}"`));
});
