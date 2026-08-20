const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('processo principal do Electron inicia sem excecoes', { skip: process.platform !== 'win32' }, () => {
  const electron = require('electron');
  const env = {
    ...process.env,
    DLPOCKET_SMOKE_TEST: '1',
    ELECTRON_DISABLE_CRASH_REPORTING: '1'
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const result = spawnSync(electron, ['.'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env,
    timeout: 15000,
    windowsHide: true
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});
