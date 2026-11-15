// Custom agent kinds: the form as a manifest the runner loads as a user
// kind (src/engine/agents/user/build.ts, with words.ts, steps.ts, ids.ts,
// install.ts and form.ts), what the review step reads out of one
// (review.ts), a pasted import (imports.ts), the pages' words
// (src/ui/env/logic/customAgentText.ts: needed and optional marks among
// them), More settings (src/ui/env/custom-agents/logic/moreSettings.ts),
// the ACP command (engine.acp) and the way back to New agent once one is
// saved there (state/app/stack.ts).
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
  const install = await import(user('install.ts'));
  const more = await import(src('ui/env/custom-agents/logic/moreSettings.ts'));
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
  t('an empty form names what is missing', empty.ok ? [] : empty.problems.map((p) => p.field), ['name', 'command', 'installPackage']);
  t('each needed field, empty, says so plainly', empty.ok ? [] : empty.problems.map((p) => p.text), ['Give it a name.', 'Say what starts the agent.', 'Name the npm package.']);
  const emptyPy = buildUserManifest({ ...emptyForm(), install: 'python' }, { base: null, taken: [] });
  const emptyScript = buildUserManifest({ ...emptyForm(), install: 'script' }, { base: null, taken: [] });
  t('an empty package or script says so too', [emptyPy.problems.map((p) => p.text)[2], emptyScript.problems.map((p) => p.text)[2]], [
    'Name the Python package.', 'Write the install steps, or pick Nothing to install.',
  ]);
  t('a new form installs an npm package', [emptyForm().install, emptyForm().installPackage], ['npm', '']);

  const aider = {
    ...emptyForm(),
    name: 'Aider',
    command: '/root/.local/bin/aider --no-auto-commits',
    install: 'script',
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

  const bare = buildUserManifest({ ...emptyForm(), name: 'top', command: 'top', install: 'none' }, { base: null, taken: [] });
  t('no install: no update, no version check', bare.ok && ['install', 'update', 'versionCheck'].map((k) => k in bare.manifest), [false, false, false]);
  t('no bell: no events', bare.ok && 'events' in bare.manifest, false);

  const own = buildUserManifest({ ...aider, versionCommand: "aider -V 'x y'", versionPattern: 'v(\\S+)' }, { base: null, taken: [] });
  t('a version command and pattern of its own', own.ok && own.manifest.versionCheck, { argv: ['aider', '-V', 'x y'], pattern: 'v(\\S+)' });

  // --- build: Node.js and the phone tools --------------------------------
  const node = buildUserManifest({ ...emptyForm(), name: 'Codex', command: 'codex', install: 'script', script: 'npm i -g --prefix "$HOME/.local" @openai/codex', needsNode: true }, { base: null, taken: [] });
  t('Node.js 22 goes in first', node.ok && node.manifest.requires, { linux: 'required', runtimes: ['node>=22'] });
  t('Node.js alone is an install', buildUserManifest({ ...emptyForm(), name: 'n', command: 'node', install: 'none', needsNode: true }, { base: null, taken: [] }).ok, true);

  const mcp = '{"mcpServers":{"phone":{"url":"${PHONECANDO_BRIDGE_URL}/mcp","headers":{"Authorization":"Bearer ${PHONECANDO_BRIDGE_TOKEN}"}}}}';
  const toolsOn = (command) => buildUserManifest({ ...emptyForm(), name: 'x', command, install: 'none', phoneTools: true }, { base: null, taken: [] });
  t('phone tools on, in its config', toolsOn('x').manifest.phoneTools, 'mcp:config');
  t('phone tools on, in its command', toolsOn(`x --mcp-config '${mcp}'`).manifest.phoneTools, 'mcp:argv');
  const offButUsed = buildUserManifest({ ...emptyForm(), name: 'x', command: `x --mcp-config '${mcp}'`, install: 'none' }, { base: null, taken: [] });
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
  const noInstall = buildUserManifest({ ...formOf(tracked), install: 'none', script: '', packages: '', familyPackages: {}, needsNode: false, needsPython: false }, { base: { ...tracked, requires: { linux: 'required' } }, taken: [] });
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
    acpCommand: null,
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
  const hooky = { ...emptyForm(), name: 'Hooky', command: 'hooky', install: 'none', phoneTools: true };
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

  // --- ACP mode -------------------------------------------------------------
  t('a new form has no ACP command', emptyForm().acpCommand, '');
  const qwen = { ...emptyForm(), name: 'Qwen', command: '/root/.local/bin/qwen', install: 'none', acpCommand: '/root/.local/bin/qwen --acp' };
  const acpBuilt = buildUserManifest(qwen, { base: null, taken: [] });
  t('the ACP command is engine.acp', acpBuilt.ok && acpBuilt.manifest.engine, {
    style: 'tui',
    launch: { argv: ['/root/.local/bin/qwen'], cwd: '{{projectDir}}' },
    acp: { argv: ['/root/.local/bin/qwen', '--acp'] },
  });
  t('it passes the user rules with ACP', acpBuilt.ok && validate(acpBuilt.manifest, { origin: 'user' }).problems, []);
  t('the form reads the ACP command back', acpBuilt.ok && formOf(acpBuilt.manifest).acpCommand, '/root/.local/bin/qwen --acp');
  t('the review shows it', acpBuilt.ok && reviewOf(acpBuilt.manifest).acpCommand, '/root/.local/bin/qwen --acp');
  t('no ACP command: none in the review', reviewOf(built.manifest).acpCommand, null);
  const config = buildUserManifest({ ...qwen, phoneTools: true }, { base: null, taken: [] });
  t('phone tools in its config: the bridge stays in its env', config.ok && config.manifest.engine.acp, { argv: ['/root/.local/bin/qwen', '--acp'], tools: 'config' });
  const acpBase = {
    ...acpBuilt.manifest,
    engine: { ...acpBuilt.manifest.engine, acp: { argv: ['/root/.local/bin/qwen', '--acp'], tools: 'session', options: { mode: 'default' }, chat: { args: ['--resume', '{{chatId}}'] } } },
  };
  const acpEdit = buildUserManifest({ ...formOf(acpBase), acpCommand: "/root/.local/bin/qwen --acp --yolo" }, { base: acpBase, taken: [] });
  t('an edit keeps the rest of the acp block', acpEdit.ok && acpEdit.manifest.engine.acp, {
    argv: ['/root/.local/bin/qwen', '--acp', '--yolo'], tools: 'session', options: { mode: 'default' }, chat: { args: ['--resume', '{{chatId}}'] },
  });
  const acpSame = buildUserManifest(formOf(acpBase), { base: acpBase, taken: [] });
  t('an unchanged edit keeps the acp block as it was', acpSame.ok && acpSame.manifest, acpBase);
  const acpGone = buildUserManifest({ ...formOf(acpBase), acpCommand: '  ' }, { base: acpBase, taken: [] });
  t('an emptied ACP command drops the block', acpGone.ok && 'acp' in acpGone.manifest.engine, false);
  t('an open quote in it', fields({ acpCommand: "aider 'x" }), ['acpCommand']);
  t('a relative program in it', fields({ acpCommand: 'bin/aider --acp' }), ['acpCommand']);
  t('a prompt placeholder in it', fields({ acpCommand: '/root/.local/bin/aider {{prompt}}' }), ['acpCommand']);
  const acpBridged = buildUserManifest({ ...qwen, acpCommand: `/root/.local/bin/qwen --acp --mcp-config '${mcp}'` }, { base: null, taken: [] });
  t('the bridge in the ACP command needs phone tools on', acpBridged.ok ? [] : acpBridged.problems.map((p) => p.field), ['acpCommand']);
  const acpArgvTools = buildUserManifest({ ...qwen, phoneTools: true, command: `/root/.local/bin/qwen --mcp-config '${mcp}'`, acpCommand: `/root/.local/bin/qwen --acp --mcp-config '${mcp}'` }, { base: null, taken: [] });
  t('the bridge in the ACP command: the bridge stays in its env', acpArgvTools.ok && acpArgvTools.manifest.engine.acp.tools, 'config');
  const argvOnly = buildUserManifest({ ...qwen, phoneTools: true, command: `/root/.local/bin/qwen --mcp-config '${mcp}'` }, { base: null, taken: [] });
  t('the bridge only in the TUI command: the runner hands it over', argvOnly.ok && 'tools' in argvOnly.manifest.engine.acp, false);
  t('ACP wakes it, phone tools or not', [formLevel({ ...hooky, acpCommand: 'x' }), formLevel({ ...hooky, acpCommand: 'x', phoneTools: false }), formLevel({ ...hooky, acpCommand: '  ' })], ['wakes', 'wakes', 'inbox']);
  t('the review line', [text.acpReviewLine('x').startsWith('Tasks that come'), text.acpReviewLine(null).startsWith('None')], [true, true]);

  // --- how it installs: the presets (install.ts) ----------------------------
  const NPM = (spec) => `npm install -g --prefix "$HOME/.local" ${spec}`;
  const UV = (spec) => [`UV_LINK_MODE=copy uv tool install --force --python 3.12 ${spec}`, 'uv cache clean'];
  t('npm: the latest, one line', install.presetSteps('npm', ' @qwen-code/qwen-code '), [NPM('@qwen-code/qwen-code@latest')]);
  t('npm: a version of its own stays', install.presetSteps('npm', '@scope/cli@1.2.3'), [NPM('@scope/cli@1.2.3')]);
  t('Python: the latest, then the cache cleaned', install.presetSteps('python', 'aider-chat'), UV('aider-chat@latest'));
  t('Python: a version of its own stays', install.presetSteps('python', 'aider-chat==0.86.1'), UV('aider-chat==0.86.1'));
  t('the runtime each way needs', install.INSTALL_WAYS.map(install.presetRuntime), ['node', 'python', null, null]);
  t('package problems', [
    install.packageProblem('npm', ' '),
    install.packageProblem('python', ''),
    install.packageProblem('npm', '@scope/cli') == null,
    install.packageProblem('python', 'aider-chat==0.86') == null,
    ...['a b', 'x;rm -rf /', '$(id)', '--force', 'x>1', '{{port}}'].map((pkg) => install.packageProblem('npm', pkg) != null),
  ], ['Name the npm package.', 'Name the Python package.', true, true, true, true, true, true, true, true]);

  // --- how it installs: an edit reads it back -----------------------------
  t('no steps: nothing to install', install.detectInstall([], ['node']), { way: 'none', pkg: '' });
  t('our npm line, on Node.js: npm', install.detectInstall([NPM('@qwen-code/qwen-code@latest')], ['node']), { way: 'npm', pkg: '@qwen-code/qwen-code' });
  t('a version of its own reads back', install.detectInstall([NPM('cli@1.2')], ['node']), { way: 'npm', pkg: 'cli@1.2' });
  t('our uv steps, on python: Python', install.detectInstall(UV('aider-chat@latest'), ['python']), { way: 'python', pkg: 'aider-chat' });
  t('our uv steps as Mistral Vibe has them: Python', install.detectInstall(UV('mistral-vibe@latest'), ['python']), { way: 'python', pkg: 'mistral-vibe' });
  t('the uv install without the clean: a script', install.detectInstall(UV('aider-chat@latest').slice(0, 1), ['python']), { way: 'script', pkg: '' });
  t('our line without its runtime: a script', install.detectInstall([NPM('cli@latest')], ['python']), { way: 'script', pkg: '' });
  t('our steps and one more: a script', [
    install.detectInstall([...UV('mistral-vibe@latest'), 'rm -rf /root/.cache'], ['python']).way,
    install.detectInstall([NPM('x@latest'), 'npm cache clean --force'], ['node']).way,
  ], ['script', 'script']);
  t('a line of its own: a script', [
    install.detectInstall(['npm i -g --prefix "$HOME/.local" @openai/codex'], ['node']).way,
    install.detectInstall([`${NPM('x@latest')} && rm -rf /root/.npm`], ['node']).way,
    install.detectInstall([NPM('x;y@latest')], ['node']).way,
  ], ['script', 'script', 'script']);

  // --- how it installs: the command we fill in ----------------------------
  t('the program a package installs', ['@qwen-code/qwen-code', '@scope/cli@1.2', 'aider-chat==0.86', 'cline', ' ', '@solo'].map(install.programOf), [
    'qwen-code', 'cli', 'aider-chat', 'cline', '', 'solo',
  ]);
  t('the command filled in', [install.commandGuess('@google/gemini-cli'), install.commandGuess('')], ['/root/.local/bin/gemini-cli', '']);
  const typed = (pkg, from = emptyForm()) => install.changeInstall(from, { installPackage: pkg });
  const q1 = { ...emptyForm(), ...typed('@qwen-code/qwen') };
  t('the command follows the package', [q1.command, typed('@qwen-code/qwen-code', q1).command], ['/root/.local/bin/qwen', '/root/.local/bin/qwen-code']);
  t('one typed by hand stays', typed('@qwen-code/qwen-code', { ...q1, command: '/root/.local/bin/qwen --yolo' }).command, '/root/.local/bin/qwen --yolo');
  t('a package cleared clears the command we filled in', typed('', q1).command, '');
  const toPython = install.changeInstall(q1, { install: 'python' });
  t('npm to Python: the command still follows, no switch turns on', [toPython.install, toPython.command, toPython.needsPython, toPython.needsNode], ['python', '/root/.local/bin/qwen', false, false]);
  const toScript = install.changeInstall(q1, { install: 'script' });
  t('a package turned into a script keeps its line and runtime', [toScript.script, toScript.needsNode, toScript.command], [NPM('@qwen-code/qwen@latest'), true, '/root/.local/bin/qwen']);
  const ownScript = install.changeInstall({ ...q1, script: 'make install' }, { install: 'script' });
  t('a script already typed stays', [ownScript.script, ownScript.needsNode], ['make install', false]);
  t('nothing to install keeps the command', install.changeInstall(q1, { install: 'none' }).command, '/root/.local/bin/qwen');

  // --- how it installs: build with each ------------------------------------
  const qwenNpm = { ...emptyForm(), name: 'Qwen Code', install: 'npm', installPackage: '@qwen-code/qwen-code', command: '/root/.local/bin/qwen' };
  const npmBuilt = buildUserManifest(qwenNpm, { base: null, taken: [] });
  t('npm: its line, Node.js 22, the update and the check', npmBuilt.ok && [npmBuilt.manifest.requires, npmBuilt.manifest.install, npmBuilt.manifest.update, npmBuilt.manifest.versionCheck], [
    { linux: 'required', runtimes: ['node>=22'] },
    { steps: [NPM('@qwen-code/qwen-code@latest')] },
    { steps: [NPM('@qwen-code/qwen-code@latest')] },
    { argv: ['/root/.local/bin/qwen', '--version'], pattern: '(\\d+(?:\\.\\d+)+)' },
  ]);
  t('npm: it passes the user rules', npmBuilt.ok && validate(npmBuilt.manifest, { origin: 'user' }).problems, []);
  t('npm: the form reads it back', npmBuilt.ok && formOf(npmBuilt.manifest), qwenNpm);
  const npmSame = buildUserManifest(formOf(npmBuilt.manifest), { base: npmBuilt.manifest, taken: [] });
  t('npm: an unchanged edit is the kind as it was', npmSame.ok && npmSame.manifest, npmBuilt.manifest);
  const aiderPy = { ...emptyForm(), name: 'Aider', install: 'python', installPackage: 'aider-chat', command: '/root/.local/bin/aider' };
  const pyBuilt = buildUserManifest(aiderPy, { base: null, taken: [] });
  t('Python: its line and the python runtime', pyBuilt.ok && [pyBuilt.manifest.requires, pyBuilt.manifest.install], [
    { linux: 'required', runtimes: ['python'] },
    { steps: UV('aider-chat@latest') },
  ]);
  t('Python: it passes the user rules', pyBuilt.ok && validate(pyBuilt.manifest, { origin: 'user' }).problems, []);
  t('Python: the form reads it back', pyBuilt.ok && formOf(pyBuilt.manifest), aiderPy);
  const pySame = buildUserManifest(formOf(pyBuilt.manifest), { base: pyBuilt.manifest, taken: [] });
  t('Python: an unchanged edit is the kind as it was', pySame.ok && pySame.manifest, pyBuilt.manifest);
  const none = buildUserManifest({ ...qwenNpm, install: 'none' }, { base: null, taken: [] });
  t('nothing to install: no install, no runtime', none.ok && [none.manifest.requires, 'install' in none.manifest], [{ linux: 'required' }, false]);
  const both = buildUserManifest({ ...qwenNpm, needsPython: true }, { base: null, taken: [] });
  t('npm with the Python switch on: both runtimes', both.ok && both.manifest.requires.runtimes, ['node>=22', 'python']);
  const npmNewerBase = { ...npmBuilt.manifest, requires: { linux: 'required', runtimes: ['node>=24'] } };
  const npmNewer = buildUserManifest(formOf(npmNewerBase), { base: npmNewerBase, taken: [] });
  t('npm: a newer Node.js the kind had stays', npmNewer.ok && npmNewer.manifest, npmNewerBase);
  const npmToPy = buildUserManifest({ ...formOf(npmBuilt.manifest), install: 'python', installPackage: 'qwen-code' }, { base: npmBuilt.manifest, taken: [] });
  t('npm to Python in an edit: Node.js goes, python comes', npmToPy.ok && [npmToPy.manifest.requires.runtimes, npmToPy.manifest.install.steps, npmToPy.manifest.update.steps], [
    ['python'], UV('qwen-code@latest'), UV('qwen-code@latest'),
  ]);
  t('a package that is missing or bad lands on its field', [
    fields({ install: 'npm', installPackage: '' }),
    fields({ install: 'python', installPackage: 'a b' }),
    fields({ install: 'npm', installPackage: 'x'.repeat(1100) }),
  ], [['installPackage'], ['installPackage'], ['installPackage']]);
  t('a script with no steps is a problem', fields({ install: 'script', script: ' \n ' }), ['script']);
  t('a package install ignores the script it hides', buildUserManifest({ ...qwenNpm, script: 'echo {{port}}' }, { base: null, taken: [] }).ok, true);

  // --- how it installs: an old kind with a script of its own stays a script --
  t('an old kind with its own steps reads as a script', [formOf(base).install, formOf(base).script, formOf(base).installPackage], ['script', scriptOf(steps), '']);
  const codexOld = { ...node.manifest, id: 'user.codex' };
  t('a one-line script of its own stays one', [formOf(codexOld).install, formOf(codexOld).script, formOf(codexOld).needsNode], ['script', 'npm i -g --prefix "$HOME/.local" @openai/codex', true]);
  const codexSame = buildUserManifest(formOf(codexOld), { base: codexOld, taken: [] });
  t('it saves back as it was', codexSame.ok && codexSame.manifest, codexOld);
  const runtimesOrder = { ...base, requires: { ...base.requires, runtimes: ['python>=3', 'node>=24'] } };
  const orderSame = buildUserManifest(formOf(runtimesOrder), { base: runtimesOrder, taken: [] });
  t('runtimes keep their order in an edit', orderSame.ok && orderSame.manifest.requires.runtimes, ['python>=3', 'node>=24']);

  // --- More settings (moreSettings.ts) ---------------------------------------
  t('More settings holds only form fields', more.MORE_FIELDS.every((f) => f in emptyForm()), true);
  const P = (...fs) => fs.map((field) => ({ field, text: 'x' }));
  t('a problem in More settings opens it', [more.moreHasProblem(P('titlePattern')), more.moreHasProblem(P('name', null, 'acpCommand'))], [true, false]);
  t('how many More settings are set', [
    more.moreSetCount(emptyForm()),
    more.moreSetCount({ ...emptyForm(), packages: ' curl ', bellWaits: true, familyPackages: { apk: ' ' } }),
    more.moreSetCount(formOf(base)),
    more.moreSetCount({ ...emptyForm(), install: 'npm', needsNode: true }),
    more.moreSetCount({ ...emptyForm(), install: 'script', needsNode: true }),
  ], [0, 2, 6, 0, 1]);
  t('the review names our Python', ['python', 'python>=3'].map(text.runtimeName), ['Python 3.12 and uv', 'Python 3 or newer']);

  // --- the form's words ------------------------------------------------------
  t('a choice for each way', Object.keys(text.INSTALL_CHOICES), install.INSTALL_WAYS);
  t('the command hint says where a guess came from', [text.commandHint('npm').startsWith('Filled in'), text.commandHint('script').startsWith('What starts')], [true, true]);
  t('More settings: what is in it, how many are set', [text.MORE_WHAT.startsWith('Packages'), text.moreCount(0), text.moreCount(2)], [true, '', '2 set']);
  t('the line under the title', text.FORM_NEEDS, 'Name, how it installs and the command are needed. The rest is optional.');

  // --- needed and optional --------------------------------------------------
  const tagged = (tag) => Object.keys(emptyForm()).filter((f) => text.FIELD_TAGS[f] === tag);
  t('needed: name, the install and its package or script, the command', tagged('needed'), ['name', 'command', 'install', 'installPackage', 'script']);
  t('optional: the ACP command and every text field in More settings', tagged('optional'), [
    'packages', 'familyPackages', 'versionCommand', 'versionPattern', 'titlePattern', 'messageEvent', 'messageJson', 'acpCommand',
  ]);
  t('a switch has no mark (off is safe)', Object.keys(emptyForm()).filter((f) => typeof emptyForm()[f] === 'boolean').map((f) => text.FIELD_TAGS[f] ?? null), [null, null, null, null, null]);
  t('everything in More settings is optional or a switch', more.MORE_FIELDS.every((f) => text.FIELD_TAGS[f] !== 'needed'), true);
  t('the mark as drawn and as spoken', [text.tagText('needed'), text.tagText('optional'), text.spokenLabel('Name', 'needed'), text.spokenLabel('Phone tools')], [
    '· needed', '· optional', 'Name, needed', 'Phone tools',
  ]);

  // --- what an optional field means left empty -------------------------------
  const fieldsOf = (pred) => Object.keys(emptyForm()).filter(pred);
  const helpOf = (f) => text.fieldHelp(f, '/root/.local/bin/qwen');
  t('every optional field says what empty means', fieldsOf((f) => text.FIELD_TAGS[f] === 'optional' && !helpOf(f)), []);
  t('a needed field has no help', fieldsOf((f) => text.FIELD_TAGS[f] === 'needed' && helpOf(f) != null), []);
  t('a text field: If empty…', fieldsOf((f) => text.FIELD_TAGS[f] === 'optional' && !helpOf(f).empty.startsWith('If ')), []);
  t('switches say what off means', ['phoneTools', 'bellWaits', 'needsNode', 'needsPython'].map((f) => helpOf(f)?.empty.startsWith('Off: ')), [true, true, true, true]);
  t('exit 2 has its own note, no help', helpOf('messageExit2'), null);
  t('the version command names the program', [helpOf('versionCommand').empty, text.fieldHelp('versionCommand', '').empty], [
    'If empty: we run /root/.local/bin/qwen --version.', 'If empty: we run its program --version.',
  ]);
  t('the ideas that need it get more', ['acpCommand', 'messageEvent'].map((f) => typeof helpOf(f).more), ['string', 'string']);
  t('ACP: what empty means and what ACP is', [
    helpOf('acpCommand').empty.startsWith('If empty: no background mode.'),
    helpOf('acpCommand').more.startsWith('ACP (Agent Client Protocol)'),
  ], [true, true]);
  t('the hints leave empty to the help', [text.MESSAGE_EVENT_HINT, text.MESSAGE_JSON_HINT].map((h) => h.includes('Empty:')), [false, false]);
  t('the note under the ACP command and its guide', [
    text.ACP_NONE_NOTE.startsWith('No ACP mode? PhoneCanDo is source-available'),
    text.ADD_AGENT_GUIDE.url,
    text.openElsewhere('https://x.example'),
  ], [true, 'https://github.com/krishna-kush/PhoneCanDo/blob/HEAD/docs/guides/adding-an-agent.md', 'Open https://x.example in a browser.']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
