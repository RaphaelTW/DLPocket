'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVideoSelector, codecName, qualityProfiles, overallProgress } = require('../src/core');

test('builds safe quality, FPS and codec selector with fallback', () => {
  assert.equal(buildVideoSelector('1080', '60', 'h264'), 'bv*[height<=1080][fps<=60][vcodec^=avc]+ba/bv*[height<=1080][fps<=60]+ba/b[height<=1080][fps<=60]');
});

test('classifies supported codecs', () => {
  assert.equal(codecName('avc1.640028'), 'H.264');
  assert.equal(codecName('vp9'), 'VP9');
  assert.equal(codecName('av01.0.08M.08'), 'AV1');
});

test('quality profiles are unique and sorted', () => {
  const profiles = qualityProfiles([{ height: 720, fps: 30, vcodec: 'avc1', filesize: 10 }, { height: 1080, fps: 60, vcodec: 'vp9', filesize: 20 }, { height: 720, fps: 60, vcodec: 'vp9', filesize: 15 }]);
  assert.deepEqual(profiles.map((item) => item.value), ['1080', '720']);
  assert.equal(profiles[1].fps, 60);
});

test('overall progress reserves post-processing range', () => {
  assert.equal(overallProgress('video', 0, 100), 75);
  assert.equal(overallProgress('video', 1, 100), 90);
  assert.equal(overallProgress('audio', 0, 100), 90);
});
