// Machines several agents share: who is on a machine, whom an install
// stops first, which machines go with a set of agents and whether a new
// agent can join one (src/state/flows/logic/machineTenants.ts); New agent's
// Share a machine choices (src/ui/env/logic/shareChoices.ts); and what the
// pages say about a shared machine (src/ui/env/logic/sharedMachineText.ts).
// Imports the real pure modules (Node 22.18+ strips their types), so these
// cannot drift.
// Run: node test_shared_machines.js (or pnpm check:vectors)
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
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

(async () => {
  // --- who is on a machine -----------------------------------------------------
  const m = await import(src('state/flows/logic/machineTenants.ts'));
  const agent = (id, kind, imageId, createdAt, name = id) => ({ id, kind, imageId, createdAt, name });
  const oc = agent('oc', 'opencode', 'i1', 2);
  const cc = agent('cc', 'claude', 'i1', 1);
  const gm = agent('gm', 'gemini', 'i1', 3);
  const oc2 = agent('oc2', 'opencode', 'i1', 4);
  const solo = agent('solo', 'opencode', 'i2', 5);
  const all = [oc, cc, gm, oc2, solo];
  t('agents on a machine, oldest first', m.agentsOn(all, 'i1').map((a) => a.id), ['cc', 'oc', 'gm', 'oc2']);
  t('co-tenants leave the agent out', m.coTenants(all, oc).map((a) => a.id), ['cc', 'gm', 'oc2']);
  t('a machine to itself has none', m.coTenants(all, solo), []);

  const runtimes = { opencode: [], claude: ['node'], gemini: ['node'], aider: ['python'] };
  const runtimesOf = (kind) => runtimes[kind] ?? [];
  t('an install stops its own kind', m.stoppedByInstall(all, oc, runtimesOf).map((a) => a.id), ['oc2']);
  t('an install stops kinds on the same runtime', m.stoppedByInstall(all, cc, runtimesOf).map((a) => a.id), ['gm']);
  t('a kind on another runtime runs on', m.stoppedByInstall([...all, agent('ai', 'aider', 'i1', 6)], gm, runtimesOf).map((a) => a.id), ['cc']);

  t('a machine goes with its last agent', m.freedImages(all, ['solo']), ['i2']);
  t('a shared machine stays while one is left', m.freedImages(all, ['oc', 'cc', 'gm']), []);
  t('every agent of a machine picked: it goes, once', m.freedImages(all, ['oc', 'cc', 'gm', 'oc2', 'solo']), ['i1', 'i2']);

  const machine = (state, kinds) => ({ state, agents: kinds.map((kind) => ({ kind })) });
  const opencode = { id: 'opencode', stateFolder: false };
  const claude = { id: 'claude', stateFolder: true };
  t('a ready machine takes another kind', m.shareBlockOf(machine('ready', ['claude']), opencode, null), null);
  t('not while it is set up', m.shareBlockOf(machine('creating', ['claude']), opencode, null), { kind: 'not_ready', state: 'creating' });
  t('not when its system cannot run the kind', m.shareBlockOf(machine('ready', []), opencode, 'needs_linux'), { kind: 'offer', block: 'needs_linux' });
  t('two of a kind without a folder each cannot share', m.shareBlockOf(machine('ready', ['opencode']), opencode, null), { kind: 'same_kind' });
  t('two of a kind with a folder each can', m.shareBlockOf(machine('ready', ['claude']), claude, null), null);

  // --- New agent's Share a machine ---------------------------------------------
  const c = await import(src('ui/env/logic/shareChoices.ts'));
  const env = (id, kind, createdAt) => ({ id, source: kind === 'registry' ? { kind, image: 'alpine', tag: '3.22', digest: '' } : { kind, version: '1' }, os: null, createdAt });
  const alpine = { id: 'alpine', versionId: '3.22', idLike: [], prettyName: null, family: 'apk', shell: '/bin/sh' };
  const image = (id, envId, state, createdAt, extra = {}) => ({ id, envId, state, os: null, sizeBytes: 0, createdAt, ...extra });
  const envs = [env('own', 'registry', 2), env('and', 'android', 3), env('def', 'default', 1)];
  const images = [
    image('a', 'and', 'ready', 1),
    image('o', 'own', 'ready', 2, { os: alpine, sizeBytes: 1_200_000_000 }),
    image('d', 'def', 'resetting', 3),
    image('e', 'def', 'ready', 4),
  ];
  const agents = [
    agent('x', 'opencode', 'o', 3, 'opencode'),
    agent('y', 'claude', 'd', 4, 'Claude Code'),
    agent('z', 'opencode', 'a', 5, 'opencode 2'),
    agent('w', 'gemini', 'o', 6, 'Gemini CLI'),
  ];
  const choices = c.shareChoices(envs, images, agents, true);
  t('machines with agents, Default first, Android last', choices.map((x) => x.key), ['d', 'o', 'a']);
  t('titled by its agents, oldest first', choices[1].title, 'opencode and Gemini CLI');
  t('its system and size', choices[1].subtitle, 'alpine:3.22 · 1.2 GB');
  t('judged on its OS, its state apart', choices[1].env, { kind: 'linux', family: 'apk', ready: true });
  t('its state', choices[0].state, 'resetting');
  t('logos: its image, then its OS', choices[1].logoKeys, ['alpine']);
  t('an Android machine has no logo', choices[2].logoKeys, []);
  t('without Linux: only Android machines', c.shareChoices(envs, images, agents, false).map((x) => x.key), ['a']);
  t('none without agents', c.shareChoices(envs, images, [], true), []);

  t('can join: no line', c.shareBlockText(null, 'opencode'), null);
  t('not ready', c.shareBlockText({ kind: 'not_ready', state: 'resetting' }, 'opencode'), 'This machine is being reset');
  t('setup failed', c.shareBlockText({ kind: 'not_ready', state: 'failed' }, 'opencode'), "This machine's setup didn't finish");
  t('its system cannot run it', c.shareBlockText({ kind: 'offer', block: 'needs_linux' }, 'opencode'), 'Needs a Linux env');
  t('same kind', c.shareBlockText({ kind: 'same_kind' }, 'opencode'), "Two opencode agents can't share a machine");

  // --- what the pages say -----------------------------------------------------
  const w = await import(src('ui/env/logic/sharedMachineText.ts'));
  t('note with machines to share', w.placeNote('Claude Code', true), 'Claude Code gets its own machine, made from the system you pick, or shares a machine with agents you have. What it installs stays in its machine.');
  t('note without', w.placeNote('Claude Code', false), 'Claude Code gets its own machine, made from the system you pick. What it installs stays in that machine.');
  t('share one', w.shareTitle(['opencode']), "Share opencode's machine?");
  t('share several', w.shareTitle(['opencode', 'Gemini CLI']), 'Share this machine with opencode and Gemini CLI?');
  t('share confirm, two', w.shareMessage('Claude Code', ['opencode']), [
    'We recommend its own machine. If Claude Code joins opencode, they share everything in it: projects, installed tools and settings. Each keeps its own sign-in and chats.',
    '',
    "• If both work on the same project at once, they can undo each other's changes. We tell each agent who else is here and ask it to work on its own branch.",
    '• Resetting the machine stops both and resets it for both.',
    '• An install or update by one can change tools the other uses.',
    '• The machine is deleted only with its last agent.',
  ].join('\n'));
  t('share confirm, several', w.shareMessage('opencode 2', ['opencode', 'Gemini CLI']).split('\n').slice(0, 4), [
    'We recommend its own machine. If opencode 2 joins opencode and Gemini CLI, they all share everything in it: projects, installed tools and settings. Each keeps its own sign-in and chats.',
    '',
    "• If two of them work on the same project at once, they can undo each other's changes. We tell each agent who else is here and ask it to work on its own branch.",
    '• Resetting the machine stops them all and resets it for all of them.',
  ]);
  t('delete, one mate', w.deleteSharedMessage(['opencode']), 'Its machine stays, because opencode still uses it, and so do the projects in it. Its sign-in and chats go with it.');
  t('delete, two mates', w.deleteSharedMessage(['opencode', 'Gemini CLI']), 'Its machine stays, because opencode and Gemini CLI still use it, and so do the projects in it. Its sign-in and chats go with it.');
  t('reset alone', w.resetMessage('alpine:3.22', ['opencode']), "System files go back to the alpine:3.22 base. Your projects, chats and keys stay. Anything you installed goes; we'll offer to install it again. The agent stops first.");
  t('reset shared', w.resetMessage('alpine:3.22', ['opencode', 'Gemini CLI']), "System files go back to the alpine:3.22 base. opencode and Gemini CLI share it, so both stop first. Your projects, chats and keys stay. Tools either agent installed go away; we'll offer to install them again.");
  t('reset shared by three', w.resetMessage('alpine:3.22', ['a', 'b', 'c']), "System files go back to the alpine:3.22 base. a, b and c share it, so they all stop first. Your projects, chats and keys stay. Tools any of them installed go away; we'll offer to install them again.");
  t('machine agents title', w.machineAgentsTitle(3), 'On this machine · 3 agents');
  t('update alone', w.updateStopsLine([]), 'An update stops the agent first.');
  t('update stops another', w.updateStopsLine(['Gemini CLI']), 'An update stops the agent first, and Gemini CLI too, since it uses the same files.');
  t('shared log', w.sharedLogLine(['opencode']), 'opencode shares this machine, so this may be the log of its install.');
  t('shared machine line', w.sharedMachineLine('1.2 GB'), 'Shared machine · 1.2 GB');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
