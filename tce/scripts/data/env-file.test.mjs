import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ENV_KEYS, envFilePath, parseEnvFile, withEnvFile } from './env-file.mjs';

test('parseEnvFile reads shell-style lines, only the keys asked for', () => {
  const text = [
    '# signing',
    'PHONECANDO_STORE_PASSWORD=hunter2',
    'export TCE_READ_TOKEN="tok en"  ',
    "CLOUDFLARE_ACCOUNT_ID='0123'",
    'TCE_READ_TOKEN_OLD=x',
    '   ',
  ].join('\n');
  assert.deepEqual(parseEnvFile(text, ENV_KEYS), { TCE_READ_TOKEN: 'tok en', CLOUDFLARE_ACCOUNT_ID: '0123' });
  assert.deepEqual(parseEnvFile('TCE_READ_TOKEN=abc # comment\r\nTCE_READ_TOKEN=def', ['TCE_READ_TOKEN']), { TCE_READ_TOKEN: 'def' });
  assert.deepEqual(parseEnvFile('TCE_READ_TOKEN="a\\"b"', ['TCE_READ_TOKEN']), { TCE_READ_TOKEN: 'a"b' });
});

test('envFilePath: PHONECANDO_RELEASE_ENV, else the repo-root .env', () => {
  assert.equal(envFilePath({ PHONECANDO_RELEASE_ENV: '/x/y.env' }, '/repo'), '/x/y.env');
  assert.equal(envFilePath({}, '/repo'), join('/repo', '.env'));
});

test('withEnvFile fills unset keys only; the environment wins; a missing file adds nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tce-env-'));
  try {
    writeFileSync(join(dir, '.env'), 'TCE_READ_TOKEN=from-file\nCLOUDFLARE_ACCOUNT_ID=acct\nPHONECANDO_STORE_PASSWORD=hunter2\n');
    const merged = withEnvFile({ HOME: '/h', CLOUDFLARE_ACCOUNT_ID: 'from-env' }, dir);
    assert.equal(merged.TCE_READ_TOKEN, 'from-file');
    assert.equal(merged.CLOUDFLARE_ACCOUNT_ID, 'from-env');
    assert.equal(merged.PHONECANDO_STORE_PASSWORD, undefined);
    assert.equal(merged.HOME, '/h');
    const none = { A: '1' };
    assert.equal(withEnvFile(none, join(dir, 'missing')), none);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
