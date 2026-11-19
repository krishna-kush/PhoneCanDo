// goose's trust script (config/trust.sh) run with sh against permission.yaml
// files in the shapes goose reads: what it writes whole, what it adds to,
// and every file it leaves alone.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'config', 'trust.sh');
const tools = JSON.parse(readFileSync(join(here, '..', '..', '..', 'shared', 'phone-tools', 'tools.json'), 'utf8'))
  .tools.map((tool) => tool.name);
const ours = tools.map((name) => `  - phonecando__${name}\n`).join('');

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function root() {
  const dir = mkdtempSync(join(tmpdir(), 'goose-trust-'));
  made.push(dir);
  return dir;
}

function run(env) {
  execFileSync('sh', [script], { env: { PATH: process.env.PATH, ...env } });
}

// A GOOSE_PATH_ROOT whose permission.yaml holds `text`; returns the file.
function file(text) {
  const dir = root();
  mkdirSync(join(dir, 'config'));
  const path = join(dir, 'config', 'permission.yaml');
  if (text !== undefined) writeFileSync(path, text);
  run({ GOOSE_PATH_ROOT: dir, HOME: dir });
  return readFileSync(path, 'utf8');
}

const whole = `user:\n  always_allow:\n${ours}  ask_before: []\n  never_allow: []\n`;

test('it names every phone tool', () => {
  const text = readFileSync(script, 'utf8');
  for (const name of tools) assert.match(text, new RegExp(`\\b${name}\\b`), name);
});

test('a missing file in ~/.config/goose is written whole', () => {
  const home = root();
  run({ HOME: home });
  assert.equal(readFileSync(join(home, '.config', 'goose', 'permission.yaml'), 'utf8'), whole);
});

test('GOOSE_PATH_ROOT moves it, and an empty file is written whole', () => {
  assert.equal(file(), whole);
  assert.equal(file(''), whole);
});

test("goose's own shape gets only the names it lacks, the rest kept", () => {
  const before =
    'smart_approve:\n  always_allow: []\n  ask_before:\n  - developer__shell\n  never_allow: []\n' +
    'user:\n  always_allow:\n  - developer__text_editor\n  - phonecando__mobile_ping\n' +
    '  ask_before:\n  - developer__shell\n  never_allow: []\n';
  const missing = tools.filter((name) => name !== 'mobile_ping').map((name) => `  - phonecando__${name}\n`).join('');
  assert.equal(
    file(before),
    'smart_approve:\n  always_allow: []\n  ask_before:\n  - developer__shell\n  never_allow: []\n' +
      `user:\n  always_allow:\n  - developer__text_editor\n  - phonecando__mobile_ping\n${missing}` +
      '  ask_before:\n  - developer__shell\n  never_allow: []\n',
  );
});

test('an indented list keeps its indent, an empty one takes ours', () => {
  const indented = file('user:\n  always_allow:\n    - a__b\n  ask_before: []\n  never_allow: []\n');
  assert.equal(
    indented,
    `user:\n  always_allow:\n    - a__b\n${ours.replaceAll('  - ', '    - ')}  ask_before: []\n  never_allow: []\n`,
  );
  assert.equal(file('user:\n  always_allow: []\n  ask_before: []\n  never_allow:\n  - x__y\n'),
    `user:\n  always_allow:\n${ours}  ask_before: []\n  never_allow:\n  - x__y\n`);
});

test('a file with no user section gets one at its end', () => {
  const before = 'smart_approve:\n  always_allow: []\n  ask_before: []\n  never_allow: []\n';
  assert.equal(file(before), before + whole);
});

test('a file that has them all, or any shape it does not know, stays as it is', () => {
  for (const before of [
    whole,
    `# mine\n${whole}`,
    'user:\n  always_allow: [a__b]\n  ask_before: []\n  never_allow: []\n',
    'user:\n  ask_before: []\n  never_allow: []\n',
    'user: {}\n',
    'user:\r\n  always_allow: []\r\n  ask_before: []\r\n  never_allow: []\r\n',
  ]) {
    assert.equal(file(before), before, before);
  }
});

test('a link is left alone', () => {
  const dir = root();
  mkdirSync(join(dir, 'config'));
  const target = join(dir, 'real.yaml');
  writeFileSync(target, 'smart_approve:\n  always_allow: []\n  ask_before: []\n  never_allow: []\n');
  symlinkSync(target, join(dir, 'config', 'permission.yaml'));
  run({ GOOSE_PATH_ROOT: dir, HOME: dir });
  assert.equal(readFileSync(target, 'utf8'), 'smart_approve:\n  always_allow: []\n  ask_before: []\n  never_allow: []\n');
  assert.equal(existsSync(join(dir, 'config', 'permission.yaml.phonecando')), false);
});
