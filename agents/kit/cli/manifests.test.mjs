// manifests.mjs on our own tree and on small trees built per test.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { forChannel, loadManifests, matchesGlob, nativeManifests, REPO_ROOT, scanManifests } from './manifests.mjs';

const OPENCODE = JSON.parse(readFileSync(join(REPO_ROOT, 'agents/native/opencode/agent.json'), 'utf8'));
const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

// A repo root holding the given files ({ 'agents/native/x/agent.json': {...} });
// objects are written as JSON, strings as they are.
function makeRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'agents-manifests-'));
  roots.push(root);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

// A native kind with a config folder, a lite overlay and one shared part;
// its event hook is named after it, as hooks are.
function nativeKind(id, prefix, extra = {}) {
  const manifest = {
    ...OPENCODE,
    id,
    prefix,
    payload: { libs: [{ name: `lib${prefix}-engine.so`, from: 'out.bin', role: 'engine', linkage: 'system-only' }] },
    events: [{ sse: { ...OPENCODE.events[0].sse, parser: `${id}.events` } }],
    hooks: [`${id}.events`],
    ...extra,
  };
  return {
    [`agents/native/${id}/agent.json`]: manifest,
    [`agents/native/${id}/NOTICE.md`]: 'notice\n',
    [`agents/native/${id}/config/opencode.json`]: '{}\n',
    [`agents/native/${id}/config/AGENTS.md`]: 'full\n',
    [`agents/native/${id}/config-lite/AGENTS.md`]: 'lite\n',
    ...(manifest.models ? { [`agents/native/${id}/one-shot.json`]: { argv: [`{{libDir}}/lib${prefix}-engine.so`, 'run', '{{prompt}}'] } } : {}),
  };
}
const PHONE_TOOLS = { 'agents/shared/phone-tools/part.json': { into: 'phone-tools', fullOnly: ['control/**'] } };
const codes = (root) => scanManifests({ root }).problems.map((p) => `${p.file} ${p.path} ${p.code}`);

describe('our own tree', () => {
  it('loads opencode with its shared part', () => {
    const [opencode, ...rest] = nativeManifests();
    assert.equal(rest.length, 0);
    assert.equal(opencode.id, 'opencode');
    assert.equal(opencode.type, 'native');
    assert.equal(opencode.dir, join(REPO_ROOT, 'agents/native/opencode'));
    assert.deepEqual(opencode.parts, [
      { name: 'phone-tools', dir: join(REPO_ROOT, 'agents/shared/phone-tools'), into: 'phone-tools', fullOnly: ['control/**'] },
    ]);
  });

  it('ships opencode in every channel, image kinds only where there is Linux', () => {
    const all = loadManifests();
    for (const channel of ['full', 'lite', 'play']) assert.ok(forChannel(all, channel).some((e) => e.id === 'opencode'), channel);
    assert.deepEqual(forChannel(all, 'play').filter((e) => e.type === 'image'), []);
  });

  it('loads the node runtime', () => {
    const { runtimes, problems } = scanManifests();
    assert.deepEqual(problems, []);
    const node = runtimes.find((r) => r.id === 'node');
    assert.equal(node.dir, join(REPO_ROOT, 'agents/runtimes/node'));
    assert.ok(node.manifest.provides >= 22);
  });
});

describe('folder rules', () => {
  it('passes a well-formed tree', () => {
    assert.deepEqual(codes(makeRoot({ ...nativeKind('alpha', 'al'), ...PHONE_TOOLS })), []);
  });

  it('wants the folder named after the id, under its type', () => {
    const kind = nativeKind('alpha', 'al');
    const files = Object.fromEntries(Object.entries(kind).map(([p, b]) => [p.replace('native/alpha', 'image/beta'), b]));
    const got = codes(makeRoot({ ...files, ...PHONE_TOOLS }));
    assert.ok(got.includes('agents/image/beta/agent.json /id folder-name'));
    assert.ok(got.includes('agents/image/beta/agent.json /type folder-type'));
  });

  it('wants unique prefixes', () => {
    const got = codes(makeRoot({ ...nativeKind('alpha', 'al'), ...nativeKind('beta', 'al'), ...PHONE_TOOLS }));
    assert.deepEqual(got, ['agents/native/beta/agent.json /prefix duplicate-prefix']);
  });

  it('wants an agent.json in every kind folder', () => {
    const got = codes(makeRoot({ ...nativeKind('alpha', 'al'), ...PHONE_TOOLS, 'agents/image/empty/README.md': 'x' }));
    assert.deepEqual(got, ['agents/image/empty/agent.json  missing']);
  });

  it('wants the files the manifest names', () => {
    const kind = nativeKind('alpha', 'al');
    delete kind['agents/native/alpha/NOTICE.md'];
    delete kind['agents/native/alpha/config-lite/AGENTS.md'];
    delete kind['agents/native/alpha/config/opencode.json'];
    const got = codes(makeRoot({ ...kind, 'agents/native/alpha/config-lite/.keep': '' }));
    assert.deepEqual(got.sort(), [
      'agents/native/alpha/agent.json /config/instructions missing',
      'agents/native/alpha/agent.json /config/required missing',
      'agents/native/alpha/agent.json /licence/notice missing',
      'agents/shared/phone-tools/part.json  missing',
    ]);
  });

  it('checks a shared part.json', () => {
    const got = codes(
      makeRoot({ ...nativeKind('alpha', 'al'), 'agents/shared/phone-tools/part.json': { into: '../out', extra: 1 } }),
    );
    assert.deepEqual(got.sort(), [
      'agents/shared/phone-tools/part.json /extra unknown',
      'agents/shared/phone-tools/part.json /into pattern',
    ]);
  });

  it('reports manifest problems with their file', () => {
    const got = codes(makeRoot({ ...nativeKind('alpha', 'proot'), ...PHONE_TOOLS }));
    assert.ok(got.includes('agents/native/alpha/agent.json /prefix reserved'));
    const broken = codes(makeRoot({ 'agents/native/alpha/agent.json': '{ nope' }));
    assert.deepEqual(broken, ['agents/native/alpha/agent.json  json']);
  });

  it('wants a one-shot.json exactly with a models block, and a valid one', () => {
    const alpha = nativeKind('alpha', 'al');
    const shot = 'agents/native/alpha/one-shot.json';
    const without = { ...alpha, ...PHONE_TOOLS };
    delete without[shot];
    assert.deepEqual(codes(makeRoot(without)), ['agents/native/alpha/agent.json /models missing']);
    const unused = nativeKind('alpha', 'al', { models: undefined });
    unused[shot] = alpha[shot];
    assert.deepEqual(codes(makeRoot({ ...unused, ...PHONE_TOOLS })), [`${shot}  unused`]);
    const bad = { ...alpha, ...PHONE_TOOLS, [shot]: { argv: ['{{libDir}}/libother.so', 'run'] } };
    assert.deepEqual(codes(makeRoot(bad)), [`${shot} /argv pattern`, `${shot} /argv/0 pattern`]);
  });

  it('throws with every problem from loadManifests', () => {
    const root = makeRoot({ ...nativeKind('alpha', 'al'), ...nativeKind('beta', 'al') });
    assert.throws(() => loadManifests({ root }), (e) => {
      assert.match(e.message, /3 problem\(s\)/);
      assert.match(e.message, /duplicate-prefix/);
      assert.match(e.message, /phone-tools\/part\.json: missing/);
      return true;
    });
  });
});

// A runtime plugin from the schema's node fixture, its scripts present.
const NODE = JSON.parse(readFileSync(join(REPO_ROOT, 'agents/kit/schema/fixtures/runtime/valid/node.json'), 'utf8'));
function runtime(id, extra = {}) {
  return {
    [`agents/runtimes/${id}/runtime.json`]: { ...NODE, id, ...extra },
    [`agents/runtimes/${id}/install/apk.sh`]: 'true\n',
    [`agents/runtimes/${id}/install/glibc.sh`]: 'true\n',
  };
}
const GEMINI = JSON.parse(readFileSync(join(REPO_ROOT, 'agents/kit/schema/fixtures/valid/gemini-cli.json'), 'utf8'));
const imageKind = (requires, install = GEMINI.install) => ({
  'agents/image/gemini-cli/agent.json': { ...GEMINI, requires: { ...GEMINI.requires, ...requires }, install },
});

describe('runtime folder rules', () => {
  it('passes a kind and the runtime it needs', () => {
    assert.deepEqual(codes(makeRoot({ ...imageKind({}), ...runtime('node') })), []);
  });

  it('wants the folder named after the id, a runtime.json and the scripts it names', () => {
    const files = { ...runtime('node'), ...runtime('py', { id: 'python' }), 'agents/runtimes/empty/README.md': 'x' };
    delete files['agents/runtimes/node/install/apk.sh'];
    assert.deepEqual(codes(makeRoot(files)).sort(), [
      'agents/runtimes/empty/runtime.json  missing',
      'agents/runtimes/node/runtime.json /install/apk missing',
      'agents/runtimes/py/runtime.json /id folder-name',
    ]);
    const broken = codes(makeRoot({ 'agents/runtimes/node/runtime.json': { ...NODE, provides: 0 } }));
    assert.deepEqual(broken, ['agents/runtimes/node/runtime.json /provides range']);
  });

  it('wants every runtime a kind needs, new enough', () => {
    assert.deepEqual(codes(makeRoot(imageKind({}))), ['agents/image/gemini-cli/agent.json /requires/runtimes/0 missing']);
    assert.deepEqual(codes(makeRoot({ ...imageKind({ runtimes: ['node>=24'] }), ...runtime('node') })), [
      'agents/image/gemini-cli/agent.json /requires/runtimes/0 range',
    ]);
  });

  it('keeps the kind to families its runtimes install on', () => {
    const apkOnly = runtime('node', { families: ['apk'], install: { '*': 'install/apk.sh' } });
    assert.deepEqual(codes(makeRoot({ ...imageKind({}), ...apkOnly })).sort(), [
      'agents/image/gemini-cli/agent.json /install/families/0 mismatch',
      'agents/image/gemini-cli/agent.json /install/families/2 mismatch',
      'agents/image/gemini-cli/agent.json /install/families/3 mismatch',
      'agents/image/gemini-cli/agent.json /install/families/4 mismatch',
      'agents/image/gemini-cli/agent.json /install/packages/apt mismatch',
    ]);
    const xbpsOnly = runtime('node', { families: ['xbps'], install: { '*': 'install/glibc.sh' } });
    const own = { ...GEMINI.install, families: undefined, packages: { '*': GEMINI.install.packages['*'] } };
    assert.deepEqual(codes(makeRoot({ ...imageKind({}, own), ...xbpsOnly })), []);
    const twoRuntimes = { ...imageKind({ runtimes: ['node', 'py'] }, own), ...xbpsOnly, ...runtime('py', { families: ['apk'] }) };
    assert.deepEqual(codes(makeRoot(twoRuntimes)), ['agents/image/gemini-cli/agent.json /requires/runtimes mismatch']);
  });
});

describe('forChannel', () => {
  it('keeps the kinds that list the channel', () => {
    const list = [
      { id: 'a', manifest: { channels: ['full'] } },
      { id: 'b', manifest: { channels: ['full', 'lite', 'play'] } },
    ];
    assert.deepEqual(forChannel(list, 'lite').map((e) => e.id), ['b']);
    assert.deepEqual(forChannel(list, 'full').map((e) => e.id), ['a', 'b']);
  });
});

describe('matchesGlob', () => {
  it('reads globs as Gradle does', () => {
    assert.ok(matchesGlob('AGENTS.md', 'AGENTS.md'));
    assert.ok(!matchesGlob('plugins/AGENTS.md', 'AGENTS.md'));
    assert.ok(matchesGlob('plugins/automation/index.ts', 'plugins/automation/**'));
    assert.ok(!matchesGlob('plugins/mobile/index.ts', 'plugins/automation/**'));
    assert.ok(matchesGlob('a/b/c.ts', '**/c.ts'));
    assert.ok(matchesGlob('c.ts', '**/c.ts'));
    assert.ok(matchesGlob('control/x.ts', 'control/'));
    assert.ok(!matchesGlob('a/b.ts', '*.ts'));
  });
});
