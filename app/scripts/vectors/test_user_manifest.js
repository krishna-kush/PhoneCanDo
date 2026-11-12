// Custom agent kinds: the form as a manifest the runner loads as a user
// kind (src/engine/agents/user/build.ts, with words.ts, steps.ts, ids.ts
// and form.ts), what the review step reads out of one (review.ts), a pasted
// import (imports.ts), the pages' words (src/ui/env/logic/customAgentText.ts)
// and the way back to New agent once one is saved there (state/app/stack.ts).
// Every manifest built here must
// pass the kit's validator for origin user. Imports the real pure modules
// (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_user_manifest.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
// import() wants a URL: a bare Windows path (C:\...) is not one.
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;
const kit = (p) => pathToFileURL(path.join(__dirname, '../../../agents/kit/ts/manifest', p)).href;
const user = (p) => src('engine/agents/user', p);

(async () => {
  const { splitWords, joinWords, splitList } = await import(user('words.ts'));
  const { stepsOf, scriptOf } = await import(user('steps.ts'));
  const { userKindId } = await import(user('ids.ts'));
  const { emptyForm, formOf, formLevel } = await import(user('form.ts'));
  const { buildUserManifest } = await import(user('build.ts'));
  const { reviewOf } = await import(user('review.ts'));
  const { parseImport } = await import(user('imports.ts'));
  const { validate } = await import(kit('validate.ts'));
  const text = await import(src('ui/env/logic/customAgentText.ts'));
  const stack = await import(src('state/app/stack.ts'));

  // --- words -------------------------------------------------------------
  t('blanks split words', splitWords('  aider  --model x '), { ok: true, words: ['aider', '--model', 'x'] });
  t('quotes group, nothing expands', splitWords(`a 'b c' "d \\"e\\" $HOME" f\\ g`), { ok: true, words: ['a', 'b c', 'd "e" $HOME', 'f g'] });
  t('an empty quoted word stays', splitWords(`a '' b`), { ok: true, words: ['a', '', 'b'] });
  t('an open quote is a problem', splitWords(`a 'b`), { ok: false, problem: 'quote' });
  const argv = ['/root/.local/bin/x', '--mcp-config', '{"url":"${PHONECANDO_BRIDGE_URL}/mcp"}', "it's", '', 'a\\b'];
  t('join then split gives the argv back', splitWords(joinWords(argv)), { ok: true, words: argv });
  t('plain words stay bare', joinWords(['aider', '--no-auto-commits', '{{projectDir}}']), 'aider --no-auto-commits {{projectDir}}');
  t('lists split on blanks and commas', splitList(' git, ripgrep\ncurl,,'), ['git', 'ripgrep', 'curl']);

  // --- steps -------------------------------------------------------------
  t('a blank line ends a step', stepsOf('cd /tmp\nmake\n\n  \nmake install\r\n\r\nrm -f x\n'), ['cd /tmp\nmake', 'make install', 'rm -f x']);
  t('no script, no steps', stepsOf('\n \n'), []);
  t('steps back to a script', scriptOf(['cd /tmp\nmake', 'make install']), 'cd /tmp\nmake\n\nmake install');

  // --- ids ---------------------------------------------------------------
  t('the name as a slug', userKindId('My Aider 2!', []), 'user.my-aider-2');
  t('a taken id is numbered', userKindId('Aider', ['user.aider', 'user.aider-2']), 'user.aider-3');
  t('a leading digit gets a word', userKindId('42 bot', []), 'user.agent-42-bot');
  t('nothing usable', userKindId('★★★', []), 'user.agent');
  const long = userKindId('x'.repeat(200), []);
  t('a long name fits the id', [long.length <= 64, validate({ id: long }, { origin: 'user' }).problems.some((p) => p.path === '/id')], [true, false]);

  // --- build: a new kind -------------------------------------------------
  const empty = buildUserManifest(emptyForm(), { base: null, taken: [] });
  t('an empty form names what is missing', empty.ok ? [] : empty.problems.map((p) => p.field), ['name', 'command']);

  const aider = {
    ...emptyForm(),
    name: 'Aider',
    command: '/root/.local/bin/aider --no-auto-commits',
    script: 'python3 -m pip install --user --break-system-packages aider-chat\n\nrm -rf /root/.cache/pip',
    packages: 'python3 python3-pip, git',
    familyPackages: { apk: 'python3 py3-pip git', pacman: '' },
    bellWaits: true,
    titlePattern: '^aider: (.+)$',
  };
  const built = buildUserManifest(aider, { base: null, taken: ['user.aider'] });
  const steps = ['python3 -m pip install --user --break-system-packages aider-chat', 'rm -rf /root/.cache/pip'];
  t('the form as a manifest', built.ok && built.manifest, {
    schema: 1,
    id: 'user.aider-2',
    label: 'Aider',
    version: '1',
    type: 'image',
    channels: ['full', 'lite'],
    stability: 'preview',
    requires: { linux: 'required' },
    install: { packages: { '*': ['python3', 'python3-pip', 'git'], apk: ['python3', 'py3-pip', 'git'] }, steps },
    update: { steps },
    versionCheck: { argv: ['/root/.local/bin/aider', '--version'], pattern: '(\\d+(?:\\.\\d+)+)' },
    engine: { style: 'tui', launch: { argv: ['/root/.local/bin/aider', '--no-auto-commits'], cwd: '{{projectDir}}' } },
    events: [{ pty: { rules: [{ on: 'bel', event: 'waiting' }] } }],
    idle: { from: ['output'], quietSec: 120 },
    surfaces: { home: 'tui', terminal: { shell: true }, chatTitle: '^aider: (.+)$' },
    phoneTools: 'none',
  });
  t('it passes the user rules', validate(built.manifest, { origin: 'user' }).problems, []);
  t('its text is the manifest, pretty', built.ok && JSON.parse(built.text), built.manifest);
  t('the form reads back from it', formOf(built.manifest), { ...aider, packages: 'python3 python3-pip git', familyPackages: { apk: 'python3 py3-pip git' } });

  const bare = buildUserManifest({ ...emptyForm(), name: 'top', command: 'top' }, { base: null, taken: [] });
  t('no install: no update, no version check', bare.ok && ['install', 'update', 'versionCheck'].map((k) => k in bare.manifest), [false, false, false]);
  t('no bell: no events', bare.ok && 'events' in bare.manifest, false);

  const own = buildUserManifest({ ...aider, versionCommand: "aider -V 'x y'", versionPattern: 'v(\\S+)' }, { base: null, taken: [] });
  t('a version command and pattern of its own', own.ok && own.manifest.versionCheck, { argv: ['aider', '-V', 'x y'], pattern: 'v(\\S+)' });

  // --- build: Node.js and the phone tools --------------------------------
  const node = buildUserManifest({ ...emptyForm(), name: 'Codex', command: 'codex', script: 'npm i -g --prefix "$HOME/.local" @openai/codex', needsNode: true }, { base: null, taken: [] });
  t('Node.js 22 goes in first', node.ok && node.manifest.requires, { linux: 'required', runtimes: ['node>=22'] });
  t('Node.js alone is an install', buildUserManifest({ ...emptyForm(), name: 'n', command: 'node', needsNode: true }, { base: null, taken: [] }).ok, true);

  const mcp = '{"mcpServers":{"phone":{"url":"${PHONECANDO_BRIDGE_URL}/mcp","headers":{"Authorization":"Bearer ${PHONECANDO_BRIDGE_TOKEN}"}}}}';
  const toolsOn = (command) => buildUserManifest({ ...emptyForm(), name: 'x', command, phoneTools: true }, { base: null, taken: [] });
  t('phone tools on, in its config', toolsOn('x').manifest.phoneTools, 'mcp:config');
  t('phone tools on, in its command', toolsOn(`x --mcp-config '${mcp}'`).manifest.phoneTools, 'mcp:argv');
  const offButUsed = buildUserManifest({ ...emptyForm(), name: 'x', command: `x --mcp-config '${mcp}'` }, { base: null, taken: [] });
  t('the bridge in the command needs phone tools on', offButUsed.ok ? [] : offButUsed.problems.map((p) => p.field), ['phoneTools']);

  // --- build: problems land on their fields -------------------------------
  const fields = (form) => {
    const r = buildUserManifest({ ...aider, ...form }, { base: null, taken: [] });
    return r.ok ? [] : [...new Set(r.problems.map((p) => p.field))];
  };
  t('an open quote', fields({ command: "aider 'x" }), ['command']);
  t('a relative program', fields({ command: 'bin/aider' }), ['command']);
  t('a title without a group', fields({ titlePattern: '^aider' }), ['titlePattern']);
  t('a bad version pattern', fields({ versionPattern: '(' }), ['versionPattern']);
  t('a package with shell in it', fields({ packages: 'git;rm' }), ['packages']);
  t('a family package with shell in it', fields({ familyPackages: { apt: '$(x)' } }), ['familyPackages']);
  t('a placeholder in the script', fields({ script: 'echo {{port}}' }), ['script']);
  t('a step over 1024 characters', fields({ script: 'x'.repeat(1025) }), ['script']);
  t('a script over 32 KiB', fields({ script: Array.from({ length: 33 }, () => 'x'.repeat(1023)).join('\n\n') }), ['script']);
  t('a name over 64 characters', fields({ name: 'x'.repeat(65) }), ['name']);

  // --- build: an edit keeps what the form does not cover ------------------
  const base = {
    ...built.manifest,
    id: 'user.aider',
    version: '3',
    licence: { spdx: 'Apache-2.0', redistributed: false, source: 'https://github.com/Aider-AI/aider' },
    requires: { linux: 'required', commands: ['git'], runtimes: ['node>=24', 'python>=3'] },
    engine: { ...built.manifest.engine, readiness: { output: { settleMs: 500 } }, resume: { args: ['--restore-chat-history'] } },
    events: [{ pty: { rules: [{ on: 'osc9', event: 'finished' }, { on: 'bel', event: 'waiting' }] } }, { hook: { map: { Stop: 'finished' } } }],
    update: { steps: ['python3 -m pip install --user -U aider-chat'] },
    signIn: [{ method: 'api-key', note: 'Set OPENAI_API_KEY.' }],
  };
  const same = buildUserManifest(formOf(base), { base, taken: ['user.aider'] });
  t('an unchanged edit is the kind as it was', same.ok && same.manifest, base);
  const renamed = buildUserManifest({ ...formOf(base), name: 'Aider CLI', bellWaits: false, needsNode: false }, { base, taken: ['user.aider'] });
  const m = renamed.manifest;
  t('an edit keeps its id and counts its version up', [m.id, m.label, m.version], ['user.aider', 'Aider CLI', '4']);
  t('it keeps the fields the form does not cover', [m.licence, m.engine.readiness, m.engine.resume, m.signIn, m.update, m.requires.commands], [
    base.licence, base.engine.readiness, base.engine.resume, base.signIn, base.update, ['git'],
  ]);
  t('the bell rule goes, the others stay', m.events, [{ pty: { rules: [{ on: 'osc9', event: 'finished' }] } }, { hook: { map: { Stop: 'finished' } } }]);
  t('Node.js goes, other runtimes stay', m.requires.runtimes, ['python>=3']);
  t('the edit passes the user rules', validate(m, { origin: 'user' }).problems, []);
  const newer = buildUserManifest({ ...formOf(base), needsNode: true }, { base, taken: [] });
  t('a newer Node.js it asked for stays', newer.manifest.requires.runtimes, ['node>=24', 'python>=3']);
  const tracked = { ...base, update: { steps: base.install.steps } };
  const moreSteps = buildUserManifest({ ...formOf(tracked), script: 'pipx install aider-chat' }, { base: tracked, taken: [] });
  t('an update that ran the install steps follows them', moreSteps.manifest.update, { steps: ['pipx install aider-chat'] });
  const noInstall = buildUserManifest({ ...formOf(tracked), script: '', packages: '', familyPackages: {}, needsNode: false }, { base: { ...tracked, requires: { linux: 'required' } }, taken: [] });
  t('taking out the install takes its update and check', ['install', 'update', 'versionCheck'].map((k) => k in noInstall.manifest), [false, false, false]);
  const bellBack = buildUserManifest({ ...formOf(renamed.manifest), bellWaits: true }, { base: renamed.manifest, taken: [] });
  t('the bell rule goes first in the PTY rules', bellBack.manifest.events[0], { pty: { rules: [{ on: 'bel', event: 'waiting' }, { on: 'osc9', event: 'finished' }] } });

  // --- review ------------------------------------------------------------
  t('the review reads what it runs', reviewOf(base), {
    id: 'user.aider',
    label: 'Aider',
    command: '/root/.local/bin/aider --no-auto-commits',
    runtimes: ['node>=24', 'python>=3'],
    packages: [{ family: '*', names: ['python3', 'python3-pip', 'git'] }, { family: 'apk', names: ['python3', 'py3-pip', 'git'] }],
    installSteps: steps,
    updateSteps: ['python3 -m pip install --user -U aider-chat'],
    versionCommand: '/root/.local/bin/aider --version',
    env: [],
    phoneTools: false,
  });
  t('an update that is the install is not shown twice', reviewOf(built.manifest).updateSteps, null);

  // --- import ------------------------------------------------------------
  t('nothing pasted', parseImport('  ').ok, false);
  t('not JSON', parseImport('{nope').problems, ["That isn't JSON. Copy the whole agent, from { to }."]);
  t('not one object', parseImport('[1]').problems, ['An agent is one JSON object, from { to }.']);
  const bundled = parseImport(JSON.stringify({ ...built.manifest, id: 'aider' }));
  t('a bundled-style id is refused', bundled.ok ? [] : bundled.problems, ['/id: a user-added kind\'s id is user.<name>']);
  const imported = parseImport(`\n${built.text}`);
  t('an export imports as it was', imported.ok && [imported.id, imported.manifest, imported.text], ['user.aider-2', built.manifest, built.text]);

  // --- words on the pages ------------------------------------------------
  t('runtime names', ['node>=22', 'python>=3', 'ruby'].map(text.runtimeName), ['Node.js 22 or newer', 'Python 3 or newer', 'ruby']);
  t('family names', ['*', 'apk', 'nix'].map(text.familyName), ['Any OS', 'apk (Alpine)', 'nix']);
  t('a row that loads', text.kindLine('user.aider', null, 2), 'user.aider · 2 agents');
  t('a row that does not', text.kindLine('user.x', 'must be 1', 0), "user.x · Can't load: must be 1");
  t('a refused delete', text.inUseText('Aider', ['Aider', 'Aider 2']), 'Aider is the kind of Aider, Aider 2. Delete those agents first.');
  const probs = [{ field: 'name', text: 'a' }, { field: null, text: 'b' }, { field: 'name', text: 'c' }];
  t('problems by field', [text.fieldProblems(probs, 'name'), text.otherProblems(probs)], [['a', 'c'], ['b']]);

  // --- Saved from New agent: back to Choose agent with it picked ------------
  const env = { kind: 'env', envId: 'e1' };
  const fromNew = [
    { key: 1, route: { name: 'new-agent', target: env } },
    { key: 2, route: { name: 'custom-agent', kindId: null, forNewAgent: true } },
  ];
  t('saved kind picked on the step', stack.returnWithKind(fromNew, 'user.x', 9), [{ key: 9, route: { name: 'new-agent', target: env, picked: 'user.x' } }]);
  t('a form from New agent is part of the run', stack.isCreationRoute(fromNew[1].route), true);
  t('a form from the list is not', stack.isCreationRoute({ name: 'custom-agent', kindId: 'user.x' }), false);
  t('no step below: unchanged', stack.returnWithKind([{ key: 1, route: { name: 'custom-agents' } }], 'user.x', 9), [{ key: 1, route: { name: 'custom-agents' } }]);

  // --- messages from other agents -----------------------------------------
  const hooky = { ...emptyForm(), name: 'Hooky', command: 'hooky', phoneTools: true };
  t('no hook, phone tools: inbox only', formLevel(hooky), 'inbox');
  t('no hook, no tools: none', formLevel({ ...hooky, phoneTools: false }), 'none');
  t('a hook: delivered', formLevel({ ...hooky, messageEvent: 'AfterTool' }), 'delivered');
  const plain = buildUserManifest({ ...hooky, messageEvent: 'AfterTool' }, { base: null, taken: [] });
  t('a hook makes an inbox block, plain text', plain.ok && plain.manifest.inbox, { hooks: { AfterTool: { format: 'text', template: '{{messages}}' } } });
  const json = buildUserManifest(
    { ...hooky, messageEvent: 'Stop', messageJson: '{"additionalContext":"{{messages}}"}', messageExit2: true },
    { base: null, taken: [] },
  );
  t('json output and exit 2', json.ok && json.manifest.inbox.hooks.Stop, { format: 'json', template: '{"additionalContext":"{{messages}}"}', exit: 2 });
  t('the form reads the hook back', json.ok && [formOf(json.manifest).messageEvent, formOf(json.manifest).messageJson, formOf(json.manifest).messageExit2], ['Stop', '{"additionalContext":"{{messages}}"}', true]);
  const cleared = buildUserManifest({ ...hooky, messageEvent: '' }, { base: json.manifest, taken: [] });
  t('an emptied hook drops the block', cleared.ok && 'inbox' in cleared.manifest, false);
  const bad = buildUserManifest({ ...hooky, messageEvent: 'no spaces allowed' }, { base: null, taken: [] });
  t('a bad hook name lands on its field', !bad.ok && bad.problems.some((p) => p.field === 'messageEvent'), true);
  t('the hook command names the event', text.messageHookCommand('AfterTool').endsWith('sh /root/.phonecando/bin/phonecando-inbox AfterTool'), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
