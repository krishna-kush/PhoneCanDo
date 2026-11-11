// Env/agent decisions: re-read records kept when unchanged
// (src/state/logic/), error codes, agent names, orphan images, the progress
// fold and when a job counts as over (src/state/flows/logic/), then the
// agent and system pages' words and lists and New agent's place step
// (src/ui/env/logic/, src/ui/setup/copy.ts). Imports
// the real pure modules (Node 22.18+ strips their types), so these cannot
// drift.
// Run: node test_env_flows.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name} got=${q(got)} want=${q(want)}`);
}
// import() wants a URL: a bare Windows path (C:\...) is not one.
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;
const flows = (p) => src('state/flows/logic', p);
const ui = (p) => src('ui/env/logic', p);

(async () => {
  // --- state/logic -------------------------------------------------------
  const { sameValue, keepUnchangedList, keepUnchangedMap } = await import(src('state/logic/keepUnchanged.ts'));
  t('same nested value', sameValue({ a: [1, { b: null }] }, { a: [1, { b: null }] }), true);
  t('changed nested value', sameValue({ a: [1, { b: 1 }] }, { a: [1, { b: 2 }] }), false);
  t('extra key differs', sameValue({ a: 1 }, { a: 1, b: undefined }), false);
  const a1 = { id: 'a', name: 'one' }, b1 = { id: 'b', name: 'two' };
  const prevList = [a1, b1];
  t('unchanged list is the old list', keepUnchangedList(prevList, [{ id: 'a', name: 'one' }, { id: 'b', name: 'two' }]) === prevList, true);
  const changed = keepUnchangedList(prevList, [{ id: 'a', name: 'one' }, { id: 'b', name: 'TWO' }]);
  t('changed list keeps equal records', [changed === prevList, changed[0] === a1, changed[1] === b1], [false, true, false]);
  t('a removed record changes the list', keepUnchangedList(prevList, [{ id: 'a', name: 'one' }]) === prevList, false);
  const prevMap = { a: { state: 'ready' } };
  t('unchanged map is the old map', keepUnchangedMap(prevMap, { a: { state: 'ready' } }) === prevMap, true);
  t('changed map is new', keepUnchangedMap(prevMap, { a: { state: 'stopped' } }) === prevMap, false);
  t('a new key changes the map', keepUnchangedMap(prevMap, { a: { state: 'ready' }, b: { state: 'ready' } }) === prevMap, false);

  // --- flows/logic -------------------------------------------------------
  const { failureOf, linuxErrorCode, isLinuxErrorCode, failureOfError } = await import(flows('errors.ts'));
  t('record failure', failureOf('12 MB free', 'no_space'), { code: 'no_space', message: '12 MB free' });
  t('record without failure', failureOf(null, null), null);
  t('message without code is internal', failureOf('boom', null), { code: 'internal', message: 'boom' });
  t('unknown code is internal', failureOf('x', 'weird'), { code: 'internal', message: 'x' });
  t('rejection code field', linuxErrorCode({ code: 'env_in_use', message: 'x' }), 'env_in_use');
  t('rejection with leading code', linuxErrorCode(new Error('no_arm64: only amd64')), 'no_arm64');
  t('rejection without code', linuxErrorCode(new Error('boom')), 'internal');
  t('line with leading code', failureOf('network: host down', null), { code: 'network', message: 'host down' });
  t('code field wins, prefix dropped', failureOf('busy: image x is creating', 'busy'), { code: 'busy', message: 'image x is creating' });
  t('unknown prefix kept', failureOf('http: 500', null), { code: 'internal', message: 'http: 500' });
  t('null rejection', linuxErrorCode(null), 'internal');
  t('known code', isLinuxErrorCode('rate_limited'), true);
  t('prototype key is no code', isLinuxErrorCode('toString'), false);
  const coded = Object.assign(new Error('Docker Hub said 429'), { code: 'rate_limited' });
  t('failure of a rejection', failureOfError(coded), { code: 'rate_limited', message: 'Docker Hub said 429' });

  const { nextAgentName } = await import(flows('names.ts'));
  t('first agent', nextAgentName('opencode', []), 'opencode');
  t('second agent', nextAgentName('opencode', ['opencode']), 'opencode 2');
  t('fills the gap', nextAgentName('opencode', ['opencode', 'opencode 3']), 'opencode 2');
  t('case-insensitive', nextAgentName('opencode', ['OpenCode', 'opencode 2']), 'opencode 3');
  t('renamed first frees label', nextAgentName('opencode', ['work', 'opencode 2']), 'opencode');

  const { pickOrphanImage } = await import(flows('orphans.ts'));
  const img = (id, envId, state, createdAt) => ({ id, envId, state, createdAt });
  const imgs = [
    img('a', 'deb', 'ready', 1),
    img('b', 'deb', 'failed', 5),
    img('c', 'deb', 'creating', 3),
    img('d', 'alp', 'ready', 9),
    img('e', 'deb', 'deleting', 7),
  ];
  t('owned images skipped', pickOrphanImage(imgs, [{ imageId: 'a' }], 'deb')?.id, 'c');
  t('ready preferred', pickOrphanImage(imgs, [], 'deb')?.id, 'a');
  t('failed last', pickOrphanImage(imgs, [{ imageId: 'a' }, { imageId: 'c' }], 'deb')?.id, 'b');
  t('deleting never reused', pickOrphanImage([imgs[4]], [], 'deb'), null);
  t('other env ignored', pickOrphanImage(imgs, [], 'none'), null);
  t('newest among same state', pickOrphanImage([img('x', 'e', 'ready', 1), img('y', 'e', 'ready', 2)], [], 'e')?.id, 'y');

  const { applyProgress, EMPTY_PROGRESS, targetKey, FINISHED_KEEP } = await import(flows('progress.ts'));
  const ev = (jobId, id, extra) => ({
    jobId, target: { kind: 'image', id }, step: 'unpack', done: 1, total: 4, error: null, errorCode: null, finished: false, ...extra,
  });
  t('target key', targetKey({ kind: 'env', id: 'e1' }), 'env:e1');
  let s = applyProgress(EMPTY_PROGRESS, ev('j1', 'i1'));
  t('running job kept', s.progress['image:i1'].jobId, 'j1');
  s = applyProgress(s, ev('j1', 'i1', { finished: true, error: 'full', errorCode: 'no_space' }));
  t('finished drops progress', s.progress['image:i1'], undefined);
  t('finished job recorded', s.finished.j1, { target: { kind: 'image', id: 'i1' }, failure: { code: 'no_space', message: 'full' }, seq: 1 });
  s = applyProgress(s, ev('j2', 'i1'));
  t('next job shows', s.progress['image:i1'].jobId, 'j2');
  s = applyProgress(s, ev('j2', 'i1', { finished: true }));
  t('clean finish has no failure', s.finished.j2.failure, null);
  let many = EMPTY_PROGRESS;
  for (let i = 0; i < FINISHED_KEEP + 5; i++) many = applyProgress(many, ev(`k${i}`, 'z', { finished: true }));
  t('finished list bounded', Object.keys(many.finished).length, FINISHED_KEEP);
  t('newest finished kept', many.finished[`k${FINISHED_KEEP + 4}`] != null, true);
  t('oldest finished dropped', many.finished.k0, undefined);

  const { settleOutcome } = await import(flows('settle.ts'));
  const f = (code, message = 'x') => ({ code, message });
  const base = { state: 'creating', failure: null, busy: ['creating', 'resetting'], finished: null, sawBusy: false, stale: false };
  t('finished ok wins', settleOutcome({ ...base, finished: { failure: null } }), { kind: 'ok' });
  t('finished failure wins', settleOutcome({ ...base, state: 'ready', finished: { failure: f('corrupt') } }), { kind: 'failed', failure: f('corrupt') });
  t('busy record pending', settleOutcome(base), { kind: 'pending', sawBusy: true });
  t('old ready not trusted yet', settleOutcome({ ...base, state: 'ready' }), { kind: 'pending', sawBusy: false });
  t('ready after busy', settleOutcome({ ...base, state: 'ready', sawBusy: true }), { kind: 'ok' });
  t('failed reset: ready with failure', settleOutcome({ ...base, state: 'ready', failure: f('no_space'), sawBusy: true }), { kind: 'failed', failure: f('no_space') });
  t('failed after busy', settleOutcome({ ...base, state: 'failed', failure: f('no_shell'), sawBusy: true }), { kind: 'failed', failure: f('no_shell') });
  t('stale trusts record', settleOutcome({ ...base, state: 'failed', failure: f('network'), stale: true }), { kind: 'failed', failure: f('network') });
  t('failed without failure is internal', settleOutcome({ ...base, state: 'failed', sawBusy: true }).failure.code, 'internal');
  t('record gone', settleOutcome({ ...base, state: null }).failure.code, 'not_found');
  t('deleting after busy', settleOutcome({ ...base, state: 'deleting', sawBusy: true }).kind, 'failed');

  // --- ui/env/logic ------------------------------------------------------
  const { failureText, recordErrorText, startFailureCode, startErrorText, linuxFailureText } = await import(ui('errorText.ts'));
  t('code sentence', failureText(f('no_arm64')), "This image has no build for your phone's processor (arm64).");
  t('internal keeps the line', failureText(f('internal', 'boom')), 'Something went wrong on our side. (boom)');
  t('record sentence', recordErrorText({ error: 'interrupted', errorCode: 'cancelled' }), 'It stopped before it finished.');
  t('record without error', recordErrorText({ error: null, errorCode: null }), null);
  t('rejection sentence', linuxFailureText(coded), 'Docker Hub is limiting downloads right now (it allows a few an hour). Try again later.');
  t('start code', startFailureCode('start-failed:too_many_running'), 'too_many_running');
  t('start code unknown', startFailureCode('start-failed:nope'), null);
  t('start code not a failure', startFailureCode('started'), null);
  t('too many running', startErrorText('too_many_running'), 'Three agents are already running. Stop one first.');

  const { stepLabel, stepFraction, progressLine, setupPhase, setupFraction } = await import(ui('steps.ts'));
  t('known step', stepLabel('detect'), 'Detecting the system');
  t('unknown step readable', stepLabel('fetch_index'), 'Fetch index');
  t('no step', stepLabel(null), 'Getting ready');
  t('byte step fraction', stepFraction('unpack', 1, 4), 0.25);
  t('setup step has no own fraction', stepFraction('detect', 2, 6), null);
  t('unknown total', stepFraction('download', 5, null), null);
  t('download line', progressLine('download', 120e6, 290e6), 'Downloading · 41% · 120 MB of 290 MB');
  t('unpack line', progressLine('unpack', 1, 2), 'Unpacking · 50%');
  t('plain line', progressLine('seed', 5, 6), 'Setting up');
  t('phase before unpack', setupPhase('space'), -1);
  t('phase of measure', setupPhase('measure'), 2);
  t('setup starts at 0', setupFraction('start', 0, null), 0);
  t('setup mid-unpack', setupFraction('unpack', 50, 100), 0.425);
  t('setup detect ignores ordinal', setupFraction('detect', 2, 6), 0.8);
  t('setup unknown step', setupFraction('swap', 0, null), 0);

  const { envTitle, osLine } = await import(ui('titles.ts'));
  t('default title', envTitle({ kind: 'default', version: '1' }), 'Debian-based (Default)');
  t('registry title', envTitle({ kind: 'registry', image: 'alpine', tag: '3.22', digest: '' }), 'alpine:3.22');
  t('registry blank tag', envTitle({ kind: 'registry', image: 'alpine', tag: '', digest: '' }), 'alpine:latest');
  t('registry digest', envTitle({ kind: 'registry', image: 'alpine', tag: 'sha256:0123456789abcdef0123', digest: '' }), 'alpine@sha256:0123456789ab');
  t('android title', envTitle({ kind: 'android' }), 'Android (no Linux)');
  t('os line pretty', osLine({ id: 'alpine', versionId: '3.22', idLike: [], prettyName: 'Alpine Linux v3.22', family: 'apk', shell: '/bin/sh' }), 'Alpine Linux v3.22 · apk');
  t('os line plain', osLine({ id: 'arch', versionId: null, idLike: [], prettyName: null, family: null, shell: '/bin/sh' }), 'Arch · no package manager');
  t('os line before detect', osLine(null), null);

  const { parseImageRef, isHubRepo } = await import(ui('imageRef.ts'));
  t('hub name', parseImageRef('kalilinux/kali-rolling'), { ok: true, repo: 'kalilinux/kali-rolling', tag: null, hub: true });
  t('name with tag', parseImageRef('Alpine:3.22'), { ok: true, repo: 'alpine', tag: '3.22', hub: true });
  t('pasted command', parseImageRef('docker pull ubuntu:24.04'), { ok: true, repo: 'ubuntu', tag: '24.04', hub: true });
  t('docker.io prefix', parseImageRef('docker.io/library/debian'), { ok: true, repo: 'library/debian', tag: null, hub: true });
  t('other registry', parseImageRef('ghcr.io/owner/tool:v1'), { ok: true, repo: 'ghcr.io/owner/tool', tag: 'v1', hub: false });
  t('registry with port', parseImageRef('localhost:5000/x'), { ok: true, repo: 'localhost:5000/x', tag: null, hub: false });
  t('digest refused', parseImageRef('alpine@sha256:abc'), { ok: false, reason: 'digest' });
  t('empty refused', parseImageRef('  '), { ok: false, reason: 'empty' });
  t('bad name refused', parseImageRef('Bad Name'), { ok: false, reason: 'invalid' });
  t('hub repo', isHubRepo('kalilinux/kali-rolling'), true);
  t('not hub repo', isHubRepo('ghcr.io/owner/tool'), false);

  const { hubName, logoKeys, pickLogo } = await import(ui('osLogo.ts'));
  const os = (id) => ({ id, versionId: null, idLike: [], prettyName: null, family: null, shell: null });
  const reg = (image) => ({ kind: 'registry', image, tag: 'latest', digest: 'sha256:x' });
  t('hub name strips host and library', hubName('docker.io/library/Debian'), 'debian');
  t('hub name keeps a namespace', hubName('kalilinux/kali-rolling'), 'kalilinux/kali-rolling');
  t('logo keys: image, then os id', logoKeys({ source: reg('arm64v8/ubuntu'), os: os('ubuntu') }), ['arm64v8/ubuntu', 'ubuntu']);
  t('logo keys once', logoKeys({ source: reg('library/ubuntu'), os: os('ubuntu') }), ['ubuntu']);
  t('logo keys before detection', logoKeys({ source: reg('kalilinux/kali-rolling'), os: null }), ['kalilinux/kali-rolling']);
  t('default system is debian', logoKeys({ source: { kind: 'default', version: '1' }, os: null }), ['debian']);
  t('android has no logo', logoKeys({ source: { kind: 'android' }, os: null }), []);
  t('pick logo falls through', pickLogo(['acme/os', 'alpine'], { alpine: 'https://a' }), 'https://a');
  t('pick logo none', pickLogo(['acme/os'], {}), null);

  const { rankTags, mergeTags } = await import(ui('tags.ts'));
  const tag = (name) => ({ name });
  t('common tags first', rankTags(['edge', '3.21', 'latest', '3.22.1', 'x-y'].map(tag)).map((x) => x.name), ['latest', '3.22.1', '3.21', 'edge', 'x-y']);
  t('merge without repeats', mergeTags([tag('a'), tag('b')], [tag('b'), tag('c')]).map((x) => x.name), ['a', 'b', 'c']);

  const { formatBytes, formatCount, formatAgo } = await import(ui('format.ts'));
  t('bytes', formatBytes(1234567), '1.2 MB');
  t('bytes round', formatBytes(150e6), '150 MB');
  t('bytes unknown', formatBytes(null), '—');
  t('count', formatCount(1234567), '1.2M');
  const now = Date.parse('2026-11-07T00:00:00Z');
  t('ago today', formatAgo('2026-11-06T20:00:00Z', now), 'today');
  t('ago days', formatAgo('2026-11-01T00:00:00Z', now), '6 days ago');
  t('ago months', formatAgo('2026-08-01T00:00:00Z', now), '3 months ago');

  const { missingToolsLine, reinstallLine } = await import(ui('hints.ts'));
  t('missing one', missingToolsLine(['git']), 'This machine lacks git, which the agent needs.');
  t('missing many', missingToolsLine(['bash', 'git', 'rg']), 'This machine lacks bash, git and rg, which the agent needs.');
  t('reinstall few', reinstallLine(['python3', 'make']), 'The reset removed what you installed: python3 and make. You can install them again in one go.');
  t('reinstall many', reinstallLine(['a', 'b', 'c', 'd', 'e', 'f', 'g']), 'The reset removed 7 packages you installed. You can install them again in one go.');

  const { buildEnvSections } = await import(ui('sections.ts'));
  const env = (id, kind, createdAt) => ({ id, source: { kind }, createdAt });
  const secs = buildEnvSections(
    [env('and', 'android', 1), env('own2', 'registry', 3), env('def', 'default', 9), env('own1', 'registry', 2)],
    [img('i1', 'own1', 'ready', 1), img('i2', 'gone', 'ready', 2)],
    [{ id: 'a1', imageId: 'i1', createdAt: 5 }, { id: 'a2', imageId: 'lost', createdAt: 6 }],
  );
  t('env order', secs.map((x) => x.key), ['def', 'own1', 'own2', 'and', 'lost']);
  t('rows under env', secs[1].rows.map((r) => [r.image?.id, r.agent?.id]), [['i1', 'a1']]);
  t('lost rows', secs[4].rows.map((r) => r.key), ['i2', 'agent:a2']);

  const { envSubtitle, DEFAULT_ENV_TITLE } = await import(ui('titles.ts'));
  t('downloading env line', envSubtitle({ state: 'downloading', source: { kind: 'registry' }, os: null, sizeBytes: 0 }), 'Downloading');
  t('android env line', envSubtitle({ state: 'ready', source: { kind: 'android' }, os: null, sizeBytes: 0 }), "Android's own shell");
  t('default title', DEFAULT_ENV_TITLE, 'Debian-based (Default)');

  // --- New agent's place step (ui/env/logic/places.ts) ---------------------
  const { placesFor } = await import(ui('places.ts'));
  const penv = (id, kind, state, createdAt) => ({ id, source: { kind, image: id, tag: 'latest' }, state, os: null, sizeBytes: 0, createdAt });
  const placeEnvs = [penv('and', 'android', 'ready', 1), penv('own2', 'registry', 'ready', 3), penv('own1', 'registry', 'downloading', 2)];
  const places = placesFor(placeEnvs, true);
  t('place order: Default, Own oldest first, Android, download', places.map((p) => p.key), ['default', 'own1', 'own2', 'and', 'download']);
  t('Default is recommended', places.filter((p) => p.recommended).map((p) => p.key), ['default']);
  t('a downloading env is not ready to judge', places[1].env.ready, false);
  t('download has no target yet', places[places.length - 1].target, null);
  t('without Linux: only Android places', placesFor(placeEnvs, false).map((p) => p.key), ['and']);

  // --- a system's page (ui/env/logic/systemFacts.ts) -----------------------
  const { systemFacts } = await import(ui('systemFacts.ts'));
  const DAY = 24 * 60 * 60 * 1000;
  const at = 100 * DAY;
  const ownSys = {
    source: { kind: 'registry', image: 'alpine', tag: '3.22', digest: 'sha256:0123456789abcdef0123' },
    state: 'ready', os: { id: 'alpine', versionId: '3.22.1', idLike: [], prettyName: 'Alpine Linux v3.22', family: 'apk', shell: '/bin/sh' },
    sizeBytes: 3_500_000, createdAt: at - 3 * DAY,
  };
  t('own system facts', systemFacts(ownSys, at).map((f) => `${f.label}=${f.value}`), [
    'Kind=Own · downloaded', 'Image=alpine:3.22', 'Digest=sha256:0123456789ab', 'OS=Alpine Linux v3.22', 'Packages=apk', 'Size=3.5 MB', 'Added=3 days ago',
  ]);
  const baked = { source: { kind: 'default', version: '1' }, state: 'ready', os: null, sizeBytes: 0, createdAt: at };
  t('default system facts', systemFacts(baked, at).map((f) => `${f.label}=${f.value}`), [
    'Kind=Default · in the app', 'OS=not detected yet', 'Packages=—', 'Size=part of the app', 'Added=today',
  ]);
  const pulling = { ...ownSys, state: 'downloading', os: null, sizeBytes: 0, source: { ...ownSys.source, tag: '', digest: '' } };
  t('a download in progress', systemFacts(pulling, at).map((f) => `${f.label}=${f.value}`), [
    'Kind=Own · downloaded', 'Image=alpine:latest', 'OS=known once downloaded', 'Packages=—', 'Added=3 days ago',
  ]);
  t('android has no OS rows', systemFacts({ source: { kind: 'android' }, state: 'ready', os: null, sizeBytes: 0, createdAt: at }, at).map((f) => f.label), ['Kind', 'Added']);

  const { engineStateWord, engineIsUp } = await import(ui('engineState.ts'));
  t('state word', engineStateWord('died'), 'Stopped unexpectedly');
  t('no status is stopped', engineStateWord(undefined), 'Stopped');
  t('starting is up', engineIsUp('starting'), true);

  const { setupTitle, setupNote } = await import(src('ui/setup/copy.ts'));
  t('linux title', setupTitle({ path: 'linux', play: false, noLinux: null }), 'Setting up your Linux machine');
  t('play title', setupTitle({ path: 'android', play: true, noLinux: 'unavailable' }), 'Getting your agent ready');
  t('play says nothing of Linux', setupNote({ path: 'android', play: true, noLinux: 'unavailable' }), null);
  t('unavailable note', setupNote({ path: 'android', play: false, noLinux: 'unavailable' }), "Linux isn't available in this build, so your agent uses Android's own shell.");

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
