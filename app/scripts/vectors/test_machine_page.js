// A machine's page (src/ui/env/machine/logic/): the look inside's script
// and what it reads back, Update system's line, its notes, its tools as
// one list and its inspection tag. Imports the real pure modules (Node
// 22.18+ strips their types), so these cannot drift.
// Run: node test_machine_page.js (or pnpm check:vectors)
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
const logic = (p) => pathToFileURL(path.join(__dirname, '../../src/ui/env/machine/logic', p)).href;

(async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 100 * DAY;
  const fedora = { id: 'fedora', versionId: '41', idLike: [], prettyName: 'Fedora Linux 41', family: 'dnf', shell: '/bin/bash' };
  const image = { id: 'img-1', state: 'ready', os: fedora, sizeBytes: 1_234_000_000, createdAt: now - 3 * DAY };
  const env = { source: { kind: 'registry', image: 'fedora', tag: '41', digest: '' }, os: fedora };
  const android = { id: 'img-a', state: 'ready', os: null, sizeBytes: 0, createdAt: now };

  // --- Inside (inside.ts) --------------------------------------------------
  const { insideScript, parseInside, versionOf, cpuLine, INSIDE_TOOLS } = await import(logic('inside.ts'));
  const script = insideScript();
  t('the CPU first', script.startsWith('echo "arch=$(uname -m 2>/dev/null)"\necho "cpus='), true);
  t('every tool is looked up first', INSIDE_TOOLS.every((tool) => script.includes(`command -v ${tool.id} >/dev/null 2>&1 && echo "tool.${tool.id}=`)), true);
  t('go says its version its own way', script.includes('$(go version </dev/null 2>&1 | head -n 1)'), true);
  t('the script ends its last line', script.endsWith('\n'), true);

  t('git', versionOf('git version 2.39.5'), '2.39.5');
  t('python', versionOf('Python 3.11.2'), '3.11.2');
  t('node', versionOf('v22.11.0'), '22.11.0');
  t('gcc takes the first dotted number', versionOf('gcc (Debian 12.2.0-14) 12.2.0'), '12.2.0');
  t('go', versionOf('go version go1.22.1 linux/arm64'), '1.22.1');
  t('rust', versionOf('rustc 1.75.0 (82e1608df 2023-12-21)'), '1.75.0');
  t('no version in the line', versionOf('usage: thing'), null);

  const out = [
    'host=debian',
    'arch=aarch64',
    'user=root',
    'cpus=   8',
    'packages=     412',
    'tool.git=git version 2.39.5',
    'tool.python3=Python 3.11.2',
    'tool.make=',
    'noise without a key',
    '=no key',
    '',
  ].join('\n');
  const inside = parseInside(out);
  t('parsed, old keys skipped', inside, { arch: 'aarch64', cpus: 8, tools: { git: '2.39.5', python3: '3.11.2', make: null } });
  t('a blank count reads as unknown', parseInside('cpus=').cpus, null);
  t('not a count reads as unknown', parseInside('cpus=x').cpus, null);
  t('CPU line', cpuLine(inside), 'aarch64 · 8 cores');
  t('one core', cpuLine(parseInside('cpus=1')), '1 core');
  t('nothing said, no CPU line', cpuLine(parseInside('')), null);

  // --- Update system (upgrade.ts) ------------------------------------------
  const { upgradeCommand } = await import(logic('upgrade.ts'));
  t('apt updates its lists first', upgradeCommand('apt'), 'apt-get update && apt-get upgrade -y');
  t('pacman', upgradeCommand('pacman'), 'pacman -Syu --noconfirm');
  t('no package manager, no key', upgradeCommand(null), null);
  t('every family has a line', ['apt', 'apk', 'dnf', 'yum', 'microdnf', 'pacman', 'zypper', 'xbps'].every((f) => !!upgradeCommand(f)), true);

  // --- Notes (copy.ts) ------------------------------------------------------
  const { typedCommandNote } = await import(logic('copy.ts'));
  t('both typed keys', typedCommandNote(true, true), 'Install tools and Update system open a terminal with the command typed in; press Enter to run it.');
  t('one typed key', typedCommandNote(false, true), 'Update system opens a terminal with the command typed in; press Enter to run it.');
  t('no typed keys, no note', typedCommandNote(false, false), null);

  // --- Its tools as one list (machineTools.ts) -------------------------------
  const { machineTools, whoNeeds } = await import(logic('machineTools.ts'));
  const tl = (tools) => tools.map((x) => `${x.name}=${x.state}${x.version ? ` ${x.version}` : ''}${x.needed ? ' (needed)' : ''}`);
  const found = { git: '2.39.5', python3: '3.11.2', make: null };
  const tools = machineTools(['bash', 'git', 'rg'], ['rg'], found);
  t('needed first, then the common ones, each once', tl(tools).slice(0, 5), [
    'bash=here (needed)', 'Git=here 2.39.5 (needed)', 'rg=missing (needed)', 'curl=absent', 'Python=here 3.11.2',
  ]);
  t('a found tool without a version is here', tl(tools).find((r) => r.startsWith('Make=')), 'Make=here');
  t('before anything is read, nothing is known', tl(machineTools(['rg'], null, null)).slice(0, 2), ['rg=unknown (needed)', 'Git=unknown']);
  t('the look inside wins over the tools check', machineTools(['git'], ['git'], found)[0].state, 'here');
  t('one kind', whoNeeds(['Resident', 'Resident']), 'Resident');
  t('kinds of their own', whoNeeds(['Resident', 'Claude Code']), null);

  // --- The inspection tag (glance.ts) ----------------------------------------
  const g = await import(logic('glance.ts'));
  const glance = g.machineGlance({ image, env, linux: true, inside: { arch: 'aarch64', cpus: 8 }, phoneFree: 12_300_000_000, now });
  t('glance', glance, {
    os: 'Fedora Linux 41', cpu: 'aarch64 · 8 cores', made: '3 days ago', state: 'Ready', ready: true, failed: false,
    size: 1_234_000_000, free: 12_300_000_000,
  });
  t('glance line', g.glanceLine(glance), 'Fedora Linux 41 · aarch64 · 8 cores · made 3 days ago');
  t('an Android machine', g.machineGlance({ image: android, env: null, linux: false, inside: null, phoneFree: null, now }).os, "Android's own shell");
  t('an OS not known yet', g.machineGlance({ image: { ...image, os: null }, env: null, linux: true, inside: null, phoneFree: null, now }).os, 'Linux');
  t('space line', g.spaceLine(1_234_000_000, 12_300_000_000), '1.2 GB here · 12.3 GB free on the phone');
  t('space line unmeasured', g.spaceLine(null, null), 'not measured yet');
  t('clock', /^\d\d:\d\d$/.test(g.clockOf(now)), true);
  const checks = (gl, ts, who, canInstall = true) => g.inspectionChecks(gl, ts, who, true, canInstall).map((c) => `${c.ok === true ? '+' : c.ok === false ? 'x' : '?'} ${c.label}${c.install ? ' (tap)' : ''}`);
  t('inspection, something missing', checks(glance, tools, 'Resident'), [
    '+ Ready', 'x Resident needs rg (tap)', '+ Space: 1.2 GB here, 12.3 GB free', '+ Tools: bash, Git 2.39.5, Python 3.11.2, Make',
  ]);
  t('inspection, all there, several kinds', checks(glance, machineTools(['git'], [], found), null)[1], '+ Has what its agents need');
  t('inspection, still checking', checks(glance, machineTools(['rg'], null, null), 'Resident').slice(1), [
    '? Checking what Resident needs', '+ Space: 1.2 GB here, 12.3 GB free', '? Tools: looking inside…',
  ]);
  t('inspection, the phone nearly full', checks({ ...glance, free: 500_000_000 }, [], null)[1], 'x Space: the phone is nearly full, 500 MB free');
  t('inspection, setup stopped, nothing to install by tap', checks({ ...glance, ready: false, failed: true, state: 'Setup stopped' }, tools, 'Resident', false).slice(0, 2), [
    'x Setup stopped', 'x Resident needs rg',
  ]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
