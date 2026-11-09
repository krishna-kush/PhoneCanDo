// The Choose agent step: which kinds a creation path offers for a channel
// and an env (src/engine/agents/offers.ts: hidden, blocked, order, the
// preselection and when the step is skipped), then its words, its env per
// target and where Back goes (src/ui/env/logic/agentChoice.ts, routes.ts)
// and first launch's line over it (src/ui/setup/copy.ts). Imports the real
// pure modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_agent_offers.js (or pnpm check:vectors)
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

// A KindView as listKinds() passes it on, with the runner's newer fields.
const kind = (id, extra = {}) => ({
  id,
  label: id,
  type: 'native',
  channels: ['full', 'lite', 'play'],
  stability: 'stable',
  origin: 'bundled',
  requiresLinux: false,
  families: null,
  payloadPresent: true,
  ...extra,
});
const linux = { kind: 'linux', family: 'apt', ready: true };
const android = { kind: 'android', family: null, ready: true };
const ids = (offers) => offers.map((o) => o.id);
// By id, so the check reads the blocks, not the order.
const blocks = (offers) => Object.fromEntries(offers.map((o) => [o.id, o.blocked]).sort(([a], [b]) => (a < b ? -1 : 1)));

(async () => {
  const { offersFor, soleOffer, preselect, autoPick, offerEnvOf } = await import(src('engine/agents/offers.ts'));

  // --- hidden ------------------------------------------------------------
  const opencode = kind('opencode', { label: 'opencode' });
  const fullOnly = kind('codex', { label: 'Codex', channels: ['full'], stability: 'preview' });
  const noPayload = kind('goose', { payloadPresent: false });
  t('channel filters', ids(offersFor({ channel: 'lite', env: linux, kinds: [opencode, fullOnly] })), ['opencode']);
  t('full ships both', ids(offersFor({ channel: 'full', env: linux, kinds: [opencode, fullOnly] })), ['opencode', 'codex']);
  t('missing payload hidden', ids(offersFor({ channel: 'full', env: linux, kinds: [opencode, noPayload] })), ['opencode']);
  t('unknown channel hides all', offersFor({ channel: 'beta', env: linux, kinds: [opencode] }), []);

  // --- blocked -----------------------------------------------------------
  const top = kind('user.top', { label: 'top', type: 'image', channels: ['full', 'lite'], stability: 'preview', origin: 'user', requiresLinux: true });
  const needsLinux = kind('helper', { requiresLinux: true });
  const aptOnly = kind('aider', { type: 'image', requiresLinux: true, families: ['apt'] });
  const all = [opencode, top, needsLinux, aptOnly];
  t('android blocks Linux kinds', blocks(offersFor({ channel: 'full', env: android, kinds: all })), {
    aider: 'needs_linux', helper: 'needs_linux', opencode: null, 'user.top': 'needs_linux',
  });
  t('family must fit', blocks(offersFor({ channel: 'full', env: { kind: 'linux', family: 'apk', ready: true }, kinds: all })), {
    aider: 'family', helper: null, opencode: null, 'user.top': null,
  });
  t('unknown env family passes', blocks(offersFor({ channel: 'full', env: { kind: 'linux', family: null, ready: true }, kinds: [aptOnly] })), { aider: null });
  t('fitting family passes', blocks(offersFor({ channel: 'full', env: linux, kinds: [aptOnly] })), { aider: null });
  t('env not ready blocks all', blocks(offersFor({ channel: 'full', env: { ...linux, ready: false }, kinds: [opencode, top] })), {
    opencode: 'env_not_ready', 'user.top': 'env_not_ready',
  });
  t('needs_linux wins over not ready', offersFor({ channel: 'full', env: { ...android, ready: false }, kinds: [top] })[0].blocked, 'needs_linux');

  // --- order -------------------------------------------------------------
  const zed = kind('zed', { label: 'Zed' });
  const alpha = kind('alpha', { label: 'alpha' });
  const beta = kind('beta', { label: 'Beta', stability: 'preview' });
  const mine = kind('user.mine', { label: 'Aardvark', origin: 'user' });
  t(
    'available, bundled, stable, then label',
    ids(offersFor({ channel: 'full', env: android, kinds: [top, mine, beta, zed, alpha] })),
    ['alpha', 'zed', 'beta', 'user.mine', 'user.top'],
  );
  t('offer fields', offersFor({ channel: 'full', env: linux, kinds: [top] })[0], {
    id: 'user.top', label: 'top', origin: 'user', stability: 'preview', blocked: null,
  });

  // --- a runner from before the newer fields: defaults -------------------
  const bare = (id, extra = {}) => ({ id, label: id, type: 'native', channels: ['full'], stability: 'stable', ...extra });
  t('user. id is a user kind', offersFor({ channel: 'full', env: linux, kinds: [bare('user.x')] })[0].origin, 'user');
  t('image kind needs Linux', offersFor({ channel: 'full', env: android, kinds: [bare('img', { type: 'image' })] })[0].blocked, 'needs_linux');
  t('payload taken as present', ids(offersFor({ channel: 'full', env: linux, kinds: [bare('n')] })), ['n']);

  // --- the step: skip, preselect, keep -----------------------------------
  const one = offersFor({ channel: 'lite', env: linux, kinds: [opencode] });
  t('one kind: no step', soleOffer(one)?.id, 'opencode');
  t('two kinds: the step asks', soleOffer(offersFor({ channel: 'full', env: linux, kinds: [opencode, top] })), null);
  t('one kind, blocked: the step says why', soleOffer(offersFor({ channel: 'full', env: android, kinds: [top] })), null);
  t('no kinds: the step says so', soleOffer([]), null);
  const two = offersFor({ channel: 'full', env: linux, kinds: [top, opencode] });
  t('default preselected', preselect(two, 'opencode'), 'opencode');
  t('default user kind preselected too', preselect(two, 'user.top'), 'user.top');
  t('blocked default: first available', preselect(offersFor({ channel: 'full', env: android, kinds: [top, zed] }), 'user.top'), 'zed');
  t('nothing available', preselect(offersFor({ channel: 'full', env: android, kinds: [top] }), 'user.top'), null);
  t('picked kind kept when it can run', autoPick(two, 'user.top'), 'user.top');
  t('picked kind dropped on Android, two left: ask', autoPick(offersFor({ channel: 'full', env: android, kinds: [top, zed, alpha] }), 'user.top'), null);
  t('picked kind dropped, still shown blocked: ask', autoPick(offersFor({ channel: 'full', env: android, kinds: [top, zed] }), 'user.top'), null);
  t('nothing picked, one kind', autoPick(one, null), 'opencode');
  t('picked kind dropped, the only other one hidden: take it', autoPick(offersFor({ channel: 'play', env: android, kinds: [top, zed] }), 'user.top'), 'zed');

  const os = (family) => ({ id: 'alpine', versionId: '3.22', idLike: [], prettyName: null, family, shell: '/bin/sh' });
  t('env record', offerEnvOf({ source: { kind: 'registry', image: 'alpine', tag: '3', digest: 'd' }, state: 'ready', os: os('apk') }), {
    kind: 'linux', family: 'apk', ready: true,
  });
  t('android record', offerEnvOf({ source: { kind: 'android' }, state: 'ready', os: null }), { kind: 'android', family: null, ready: true });
  t('downloading record', offerEnvOf({ source: { kind: 'default', version: '1' }, state: 'downloading', os: null }).ready, false);

  // --- the step's words and env -----------------------------------------
  const { blockedText, offerBadges, targetOfferEnv, setupOfferEnv, targetLine, pickLabel, noOfferText } = await import(
    src('ui/env/logic/agentChoice.ts')
  );
  t('needs Linux text', blockedText('needs_linux'), 'Needs a Linux env');
  t('available has no reason', blockedText(null), null);
  t('custom preview badges', offerBadges({ origin: 'user', stability: 'preview' }), ['Custom', 'Preview']);
  t('bundled stable: no badges', offerBadges({ origin: 'bundled', stability: 'stable' }), []);
  const envs = [
    { id: 'def', source: { kind: 'default', version: '1' }, state: 'ready', os: os('apt') },
    { id: 'alp', source: { kind: 'registry', image: 'alpine', tag: '3.22', digest: 'd' }, state: 'downloading', os: null },
    { id: 'and', source: { kind: 'android' }, state: 'ready', os: null },
  ];
  t('env target', targetOfferEnv({ kind: 'env', envId: 'alp' }, envs), { kind: 'linux', family: null, ready: false });
  t('android env target', targetOfferEnv({ kind: 'env', envId: 'and' }, envs), { kind: 'android', family: null, ready: true });
  t('missing env is not ready', targetOfferEnv({ kind: 'env', envId: 'gone' }, envs).ready, false);
  t('default target reads its OS', targetOfferEnv({ kind: 'default' }, envs), { kind: 'linux', family: 'apt', ready: true });
  t('default before it exists', targetOfferEnv({ kind: 'default' }, []), { kind: 'linux', family: null, ready: true });
  t('own target', targetOfferEnv({ kind: 'own', repo: 'alpine', tag: { name: '3.22' }, typed: false }, envs), {
    kind: 'linux', family: null, ready: true,
  });
  t('setup on Android', setupOfferEnv('android', envs), { kind: 'android', family: null, ready: true });
  t('setup on Linux', setupOfferEnv('linux', envs), { kind: 'linux', family: 'apt', ready: true });
  t('own line', targetLine({ kind: 'own', repo: 'alpine', tag: { name: '3.22' }, typed: false }, envs),
    'The new agent gets its own machine made from alpine:3.22 once the download is done.');
  t('env line', targetLine({ kind: 'env', envId: 'def' }, envs), 'The new agent gets its own machine made from Debian-based (Default).');
  t('android env line', targetLine({ kind: 'env', envId: 'and' }, envs), "The new agent uses Android's own shell.");
  t('own button downloads', pickLabel({ kind: 'own', repo: 'a', tag: { name: 'b' }, typed: true }), 'Download');
  t('other buttons make', pickLabel({ kind: 'default' }), 'Make agent');
  t('no kinds text', noOfferText([]), 'This build has no agents to offer.');
  t('all blocked text', noOfferText([{ blocked: 'needs_linux' }]), 'None of these agents can run here.');
  t('something to pick', noOfferText([{ blocked: null }, { blocked: 'family' }]), null);

  // --- Back from the step -------------------------------------------------
  const { parentRoute } = await import(src('ui/env/logic/routes.ts'));
  const tag = { name: '3.22', sizeArm64: null, lastUpdated: null };
  t('back from Default pick', parentRoute({ name: 'new-agent', target: { kind: 'default' } }), { name: 'new-env' });
  t('back from Own pick', parentRoute({ name: 'new-agent', target: { kind: 'own', repo: 'alpine', tag, typed: true } }), {
    name: 'new-env-confirm', repo: 'alpine', tag, typed: true,
  });
  t('back from New agent here', parentRoute({ name: 'new-agent', target: { kind: 'env', envId: 'e' } }), { name: 'list' });
  t('back from Android pick', parentRoute({ name: 'new-agent', target: { kind: 'android' } }), { name: 'list' });

  // --- first launch -------------------------------------------------------
  const { CHOOSE_TITLE, chooseNote } = await import(src('ui/setup/copy.ts'));
  t('setup choose title', CHOOSE_TITLE, 'Choose your agent');
  t('play never says Linux', /Linux/.test(chooseNote({ path: 'android', play: true, noLinux: 'unavailable' })), false);
  t('Android says what cannot run', chooseNote({ path: 'android', play: false, noLinux: 'skipped' }),
    "Pick the agent to set up first; you can add more in the Env tab. It uses Android's own shell, so agents that need Linux can't run.");

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
