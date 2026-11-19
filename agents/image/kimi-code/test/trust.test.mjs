// Kimi Code's trust script (config/phonecando-trust.mjs): the one rule it
// appends to the agent's config.toml, and every file it leaves alone.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATTERN, RULE, withTrust } from '../config/phonecando-trust.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'config', 'phonecando-trust.mjs');
const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function folder() {
  const dir = mkdtempSync(join(tmpdir(), 'kimi-trust-'));
  made.push(dir);
  return dir;
}

const run = (file) => execFileSync(process.execPath, [script, file]);

test('the rule allows only our server, by its MCP prefix', () => {
  assert.equal(PATTERN, 'mcp__phonecando__*');
  assert.equal(RULE, '[[permission.rules]]\ndecision = "allow"\npattern = "mcp__phonecando__*"\n');
});

test('an empty or missing file gets the rule alone', () => {
  assert.equal(withTrust(''), RULE);
  assert.equal(withTrust('\n'), RULE);
  const file = join(folder(), 'config.toml');
  run(file);
  assert.equal(readFileSync(file, 'utf8'), RULE);
});

test('a file with other settings keeps them and gets the rule after them', () => {
  const text = 'default_model = "kimi"\n\n[providers.kimi]\ntype = "kimi"\n';
  assert.equal(withTrust(text), `${text}\n${RULE}`);
  assert.equal(withTrust('a = 1'), `a = 1\n\n${RULE}`);
});

test('rules of the same array form and a [permission] table without rules are fine', () => {
  const text = '[permission]\ndangerous_command_guard = true\n\n[[permission.rules]]\ndecision = "ask"\npattern = "Bash"\n';
  assert.equal(withTrust(text), `${text}\n${RULE}`);
});

test('a file that already names our pattern stays as it is', () => {
  assert.equal(withTrust(`a = 1\n\n${RULE}`), null);
  assert.equal(withTrust('[[permission.rules]]\ndecision = "deny"\npattern = "mcp__phonecando__*"\n'), null);
});

test('rules set in a form our table would clash with stay as they are', () => {
  for (const text of [
    '[permission]\nrules = [{ decision = "allow", pattern = "Read" }]\n',
    '[permission]\n  "rules" = []\n',
    'permission = { rules = [] }\n',
    'permission.rules = []\n',
    '[permission.rules]\ndecision = "allow"\n',
    '[ "permission" . rules ]\n',
  ]) {
    assert.equal(withTrust(text), null, text);
  }
});

test('the script writes in place, keeps the mode and leaves a link alone', () => {
  const dir = folder();
  const file = join(dir, 'config.toml');
  writeFileSync(file, 'a = 1\n', { mode: 0o600 });
  run(file);
  assert.equal(readFileSync(file, 'utf8'), `a = 1\n\n${RULE}`);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  run(file);
  assert.equal(readFileSync(file, 'utf8'), `a = 1\n\n${RULE}`);

  const target = join(dir, 'real.toml');
  const link = join(dir, 'linked.toml');
  writeFileSync(target, 'b = 2\n');
  symlinkSync(target, link);
  run(link);
  assert.equal(readFileSync(target, 'utf8'), 'b = 2\n');
});
