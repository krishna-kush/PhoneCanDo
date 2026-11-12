#!/usr/bin/env node
// CI audit for one channel APK built by .github/workflows/android.yml:
//   node .github/ci/android/audit-apk.mjs --apk <file> --channel lite|full|play
//     --build debug|release --abis arm64-v8a[,x86_64]
//     [--cert-sha256 <hex>] [--payloads '{"<agent id>":"required"|"optional"}']
//     [--proot required|optional] [--image required|optional] [--json <out.json>]
// Reuses the release gate (scripts/apk-audit.mjs) where it applies to a CI
// build: the channel audit always; the signer check against the run's
// throwaway key (the real release key never reaches CI); a native agent's
// payload check only when its payload was staged (it is not in git; --payloads
// marks it required). On top of that it checks what the config plugins and
// Gradle wiring promise in the built artifact: package id, version, ABI list,
// JS bundle, per-channel agent assets and manifest attributes. The agent
// kinds come from their manifests (agents/kit/cli/manifests.mjs). Every check
// runs; a markdown report goes to $GITHUB_STEP_SUMMARY (stdout when unset) and
// the exit code is 1 if any failed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { configInstructions, loadManifests } from '../../../agents/kit/cli/manifests.mjs';
import { auditChannel, checkSigner, payloadLibs, payloadProblems } from '../../../scripts/apk-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const CHANNELS = ['full', 'lite', 'play'];
const PTY_LIB = 'libphonecando_pty.so';
// The Linux runtime (app/modules/phonecando-linux): our launcher is built on
// every ABI; proot and its loader are staged for arm64 only.
const LINUX_LAUNCHER = 'libphonecando_launch.so';
const PROOT_LIBS = ['libproot.so', 'libproot-loader.so'];
const BUNDLE = 'assets/index.android.bundle';
// Every agent kind as phonecando-runner's agents.gradle packages it, from its
// manifest: assets/agents/<id>/agent.json and, with a config, the config folder
// at assets/agents/<id>/config/. Only full ships the full-only part (the
// folders config.fullOnly and its shared parts' fullOnly name); the other
// channels swap in the overlay's files, e.g. its AGENTS.md.
const KINDS = manifests();
const AGENT_ASSETS = KINDS.map(agentAssets);

const args = parseArgs(process.argv.slice(2));
const apk = resolve(args.apk ?? usage('--apk is required'));
const channel = args.channel;
const build = args.build;
if (!CHANNELS.includes(channel)) usage(`--channel must be one of ${CHANNELS.join('|')}`);
if (!['debug', 'release'].includes(build)) usage('--build must be debug|release');
const abis = (args.abis ?? usage('--abis is required')).split(',').map((a) => a.trim()).filter(Boolean);
const payloadGates = parsePayloads(args.payloads);
const prootGate = args.proot ?? 'optional';
if (!['required', 'optional'].includes(prootGate)) usage('--proot must be required|optional');
const imageGate = args.image ?? 'optional';
if (!['required', 'optional'].includes(imageGate)) usage('--image must be required|optional');
if (!existsSync(apk)) usage(`no APK at ${apk}`);

const appJson = JSON.parse(readFileSync(join(ROOT, 'app/app.json'), 'utf8')).expo;
// Release keeps the real id for every flavor; debug installs per channel
// (app/plugins/withDevAppId.js). Lite's versionCode is pinned to 1
// (withBuildChannel.js), the others take app.json's.
const expected = {
  package: build === 'debug' ? `${appJson.android.package}.${channel}.dev` : appJson.android.package,
  versionCode: channel === 'lite' ? 1 : appJson.android.versionCode,
  versionName: appJson.version,
  // app/plugins/withMinSdk.js owns the floor (the engine is built for it).
  minSdk: readFileSync(join(ROOT, 'app/plugins/withMinSdk.js'), 'utf8').match(/^const MIN_SDK = (\d+);/m)?.[1],
};

const tools = buildTools();
const bytes = readFileSync(apk);
const entries = readZipEntries(bytes);
const badging = run(tools.aapt, ['dump', 'badging', apk]);
const manifest = run(tools.aapt, ['dump', 'xmltree', apk, 'AndroidManifest.xml']);
const facts = parseBadging(badging);
const results = [];

check('package id', () => same(facts.package, expected.package));
check('versionCode', () => same(facts.versionCode, String(expected.versionCode)));
check('versionName', () => same(facts.versionName, expected.versionName));
check('minSdk', () => same(facts.minSdk, expected.minSdk));
check('debuggable', () => {
  if (build === 'debug' && !facts.debuggable) throw new Error('debug APK is not debuggable');
  if (build === 'release' && facts.debuggable) throw new Error('release APK is debuggable');
  return facts.debuggable ? 'yes (debug)' : 'no';
});
check('ABIs', () => {
  const inZip = [...new Set([...entries.keys()].map((n) => n.match(/^lib\/([^/]+)\//)?.[1]).filter(Boolean))];
  const want = [...abis].sort().join(', ');
  if ([...facts.nativeCode].sort().join(', ') !== want) {
    throw new Error(`native-code is [${facts.nativeCode.join(', ')}], requested [${want}]`);
  }
  if ([...inZip].sort().join(', ') !== want) throw new Error(`lib/ holds [${inZip.join(', ')}], requested [${want}]`);
  return want;
});
check('terminal JNI per ABI', () => {
  const missing = abis.filter((abi) => !(entries.get(`lib/${abi}/${PTY_LIB}`)?.usize > 0));
  if (missing.length) throw new Error(`${PTY_LIB} missing for ${missing.join(', ')}`);
  return `${PTY_LIB} x${abis.length}`;
});
check('channel audit (scripts/apk-audit.mjs)', () => {
  auditChannel(apk, channel, tools);
  return channel === 'full' ? 'service + uiauto + PCE classes' : 'no service, no full-only classes';
});
check('install permission', () => {
  const has = facts.permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES');
  // play's manifest overlay removes it (Play-managed updates); lite and full self-update.
  if (channel === 'play' && has) throw new Error('play requests REQUEST_INSTALL_PACKAGES');
  if (channel !== 'play' && !has) throw new Error(`${channel} lacks REQUEST_INSTALL_PACKAGES (self-update)`);
  return has ? 'requested' : 'removed';
});
if (build === 'release') {
  check('dropped permissions', () => {
    const banned = ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.BIND_ACCESSIBILITY_SERVICE'];
    const found = banned.filter((p) => facts.permissions.includes(p));
    if (found.length) throw new Error(`requests ${found.join(', ')}`);
    return 'none of SYSTEM_ALERT_WINDOW, BIND_ACCESSIBILITY_SERVICE';
  });
}
check('manifest attributes', () => {
  // withExtractNativeLibs.js: the engine is exec'd from nativeLibraryDir.
  if (!/android:extractNativeLibs\([^)]*\)=\(type 0x12\)0xffffffff/.test(manifest)) {
    throw new Error('extractNativeLibs is not true');
  }
  // withLoopbackCleartext.js: the pair UI talks http to 127.0.0.1.
  if (!/android:networkSecurityConfig\(/.test(manifest)) throw new Error('no networkSecurityConfig');
  return 'extractNativeLibs, networkSecurityConfig';
});
check('JS bundle', () => {
  const size = entries.get(BUNDLE)?.usize ?? 0;
  // Debug variants are listed in react.debuggableVariants (withBuildChannel.js)
  // and load JS from Metro; release embeds it.
  if (build === 'release' && !(size > 0)) throw new Error(`${BUNDLE} missing`);
  if (build === 'debug' && entries.has(BUNDLE)) throw new Error(`debug APK embeds ${BUNDLE} (debuggableVariants not applied)`);
  return build === 'release' ? `embedded, ${mib(size)}` : 'not embedded (Metro)';
});
check('agent config', () => {
  const names = [...entries.keys()];
  const notes = [];
  for (const kind of AGENT_ASSETS) {
    if (!kind.channels.includes(channel)) {
      const stray = names.filter((n) => n.startsWith(`${kind.root}/`));
      if (stray.length) throw new Error(`${channel} ships ${kind.root}/, but ${kind.id} does not list ${channel}`);
      notes.push(`${kind.id}: not in ${channel}`);
      continue;
    }
    sameBytes(kind.manifest.asset, kind.manifest.source);
    const cfg = kind.config;
    if (!cfg) {
      notes.push(`${kind.id}: agent.json`);
      continue;
    }
    for (const file of cfg.required) {
      if (!entries.has(`${cfg.assets}/${file}`)) throw new Error(`${cfg.assets}/${file} missing`);
    }
    const shipped = cfg.fullOnly.filter((dir) => names.some((n) => n.startsWith(`${cfg.assets}/${dir}`)));
    const lacking = cfg.fullOnly.filter((dir) => !shipped.includes(dir));
    if (channel === 'full' && lacking.length) throw new Error(`full lacks ${lacking.map((d) => `${cfg.assets}/${d}`).join(', ')}`);
    if (channel !== 'full' && shipped.length) throw new Error(`${channel} ships ${shipped.map((d) => `${cfg.assets}/${d}`).join(', ')}`);
    const fullOnly = shipped.length > 0;
    // The instructions file (AGENTS.md) comes from the overlay on the
    // channels other than full when the overlay has one.
    const file = cfg.instructions;
    let from = '';
    if (file) {
      const lite = channel !== 'full' && cfg.overlay && existsSync(join(cfg.overlay, file));
      sameBytes(`${cfg.assets}/${file}`, join(lite ? cfg.overlay : cfg.full, file));
      from = ` ${lite ? 'lite' : 'full'} ${file}`;
    }
    notes.push(`${kind.id}:${from}${fullOnly ? ` + ${shipped.join(' + ')}` : ''}`);
  }
  return notes.join('; ');
});
// The note on PhoneCanDo every agent's instructions get (agents.gradle):
// each part byte for byte, phone control on full only.
check('phonecando note', () => {
  const dir = join(ROOT, 'agents/shared/phonecando-note');
  const parts = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const shipped = [];
  for (const part of parts) {
    const asset = `assets/agents/shared/phonecando-note/${part}`;
    if (part === 'phone-control.md' && channel !== 'full') {
      if (entries.has(asset)) throw new Error(`${channel} ships ${asset}`);
      continue;
    }
    sameBytes(asset, join(dir, part));
    shipped.push(part);
  }
  return shipped.join(', ');
});
check('signer', () => {
  if (build === 'debug') {
    const certs = run(tools.apksigner, ['verify', '--print-certs', apk]);
    if (!/CN=Android Debug/i.test(certs)) throw new Error('debug APK is not signed with the debug key');
    return 'Android debug key';
  }
  const cert = (args['cert-sha256'] ?? '').toLowerCase().replace(/[\s:]/g, '');
  if (!/^[0-9a-f]{64}$/.test(cert)) throw new Error('--cert-sha256 <SHA-256 hex> is required for a release build');
  // Same check as the release gate (never the debug key, no foreign signer),
  // pinned to this run's throwaway certificate instead of the release one.
  checkSigner(apk, tools, cert);
  return `release signing config, CI key ${cert.slice(0, 12)}...`;
});
check('agent payloads', () => {
  const natives = KINDS.filter((k) => k.type === 'native');
  if (!natives.length) return 'no native agent kinds';
  const sizes = new Map([...entries].map(([name, e]) => [name, e.usize]));
  // A kind the channel does not list never ships its libs; a listed one is
  // gated only when --payloads requires it (staged payloads are not in git).
  const gated = natives.filter((k) => !k.manifest.channels.includes(channel) || payloadGates[k.id] === 'required');
  const problems = payloadProblems(sizes, channel, gated);
  if (problems.length) throw new Error(problems.join('; '));
  return natives
    .map((kind) => {
      if (!kind.manifest.channels.includes(channel)) return `${kind.id}: not in ${channel}`;
      if (payloadGates[kind.id] === 'required') return `${kind.id}: staged, non-empty`;
      const libs = payloadLibs(kind);
      const present = libs.filter((lib) => entries.has(lib));
      if (!present.length) return `${kind.id}: not staged (not in git); gate skipped`;
      return `${kind.id}: ${present.length === libs.length ? 'present' : `partly present (${present.join(', ')})`}, not gated`;
    })
    .join('; ');
});
// The baked Default env image (lre/images/default): assets/default-image/
// in full and lite, exactly the locked one in a release, stored (xz is
// compressed already), never a local build in a release; none in play.
const IMAGE_DIR = 'assets/default-image';
check('default image', () => {
  const shipped = [...entries.keys()].filter((n) => n.startsWith(`${IMAGE_DIR}/`));
  if (channel === 'play') {
    if (shipped.length) throw new Error(`play ships ${shipped.join(', ')}`);
    return 'none (play)';
  }
  const tarball = entries.get(`${IMAGE_DIR}/rootfs.tar.xz`);
  const manifest = entries.get(`${IMAGE_DIR}/image.json`);
  if (!tarball || !manifest) {
    if (imageGate === 'required') throw new Error(`${IMAGE_DIR}/rootfs.tar.xz and image.json are required`);
    return 'not staged, not gated';
  }
  if (tarball.method !== 0) throw new Error(`${IMAGE_DIR}/rootfs.tar.xz is deflated (method ${tarball.method}); it must be stored`);
  const info = JSON.parse(readZipEntry(bytes, manifest).toString('utf8'));
  if (build === 'release' && (info.local || !info.release)) {
    throw new Error(`${IMAGE_DIR}/image.json is a local build (release ${info.release ?? 'null'}); a release ships only the locked image`);
  }
  const lock = JSON.parse(readFileSync(join(ROOT, 'lre/images/default/lock.json'), 'utf8'));
  if (build === 'release' && lock.sha256 && (info.sha256 !== lock.sha256 || tarball.usize !== lock.size)) {
    throw new Error(`${IMAGE_DIR} is not the locked image (lock ${lock.sha256.slice(0, 12)}, staged ${String(info.sha256).slice(0, 12)})`);
  }
  return `${info.version ?? '?'} (${mib(tarball.usize)}, stored${info.local ? ', local build' : ''})`;
});
check('linux runtime', () => {
  const linuxNames = [LINUX_LAUNCHER, ...PROOT_LIBS];
  const shipped = [...entries.keys()].filter((n) => linuxNames.includes(basename(n)) && n.startsWith('lib/'));
  // play ships no Linux (Google Play forbids downloading executable code).
  if (channel === 'play') {
    if (shipped.length) throw new Error(`play ships ${shipped.join(', ')}`);
    return 'none (play)';
  }
  const missing = abis.filter((abi) => !(entries.get(`lib/${abi}/${LINUX_LAUNCHER}`)?.usize > 0));
  if (missing.length) throw new Error(`${LINUX_LAUNCHER} missing for ${missing.join(', ')}`);
  const proot = PROOT_LIBS.filter((lib) => entries.get(`lib/arm64-v8a/${lib}`)?.usize > 0);
  if (proot.length === 1) throw new Error(`only ${proot[0]} staged; proot needs ${PROOT_LIBS.join(' + ')}`);
  if (prootGate === 'required' && !proot.length) throw new Error(`proot was staged but ${PROOT_LIBS.join(' + ')} are not in lib/arm64-v8a`);
  // The launcher runs proot with --status-fd (lre/proot/patches/0002); an
  // older proot would fail every guest command.
  if (proot.length && !readZipEntry(bytes, entries.get('lib/arm64-v8a/libproot.so')).includes('--status-fd')) {
    throw new Error('libproot.so lacks --status-fd (lre/proot/patches/0002): stage a proot build that includes it');
  }
  return `launcher on ${abis.join(', ')}; proot ${proot.length ? 'staged, with --status-fd' : 'not staged, not gated'}`;
});

const abiRows = abis.map((abi) => {
  const libs = [...entries].filter(([n]) => n.startsWith(`lib/${abi}/`));
  return {
    abi,
    files: libs.length,
    compressed: libs.reduce((s, [, e]) => s + e.csize, 0),
    uncompressed: libs.reduce((s, [, e]) => s + e.usize, 0),
  };
});
const dex = [...entries].filter(([n]) => /^classes\d*\.dex$/.test(n));
const report = {
  apk: basename(apk),
  channel,
  build,
  package: facts.package,
  versionName: facts.versionName,
  versionCode: Number(facts.versionCode),
  minSdk: facts.minSdk,
  targetSdk: facts.targetSdk,
  launchableActivity: facts.activity,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  abis: abiRows,
  dexBytes: dex.reduce((s, [, e]) => s + e.usize, 0),
  bundleBytes: entries.get(BUNDLE)?.usize ?? 0,
  checks: results,
};
if (args.json) {
  mkdirSync(dirname(resolve(args.json)), { recursive: true });
  writeFileSync(resolve(args.json), `${JSON.stringify(report, null, 2)}\n`);
}
writeSummary(report);

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`::error title=APK audit (${channel} ${build})::${r.name}: ${r.detail}`);
console.log(`${report.apk}: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

// ---------------------------------------------------------------------------

function manifests() {
  try {
    return loadManifests({ root: ROOT });
  } catch (error) {
    console.error(`audit-apk: ${error.message}`);
    process.exit(2);
  }
}

// The packaged form of one manifest entry (agents/kit/cli/manifests.mjs).
function agentAssets(kind) {
  const root = `assets/agents/${kind.id}`;
  const c = kind.manifest.config;
  // Full-only folders as packaged paths: "plugins/automation/**" ->
  // "plugins/automation/", a shared part's under the folder it lands in.
  const folders = (globs, under = '') => globs.filter((g) => g.endsWith('/**')).map((g) => `${under}${g.slice(0, -2)}`);
  return {
    id: kind.id,
    channels: kind.manifest.channels,
    root,
    manifest: { asset: `${root}/agent.json`, source: join(kind.dir, 'agent.json') },
    config: c?.dir && {
      assets: `${root}/config`,
      full: join(kind.dir, c.dir),
      overlay: c.overlay ? join(kind.dir, c.overlay) : null,
      required: c.required ?? [],
      instructions: configInstructions(kind.manifest),
      fullOnly: [...folders(c.fullOnly ?? []), ...kind.parts.flatMap((p) => folders(p.fullOnly, `${p.into}/`))],
    },
  };
}

// A packaged file is byte-identical to its source in the repository.
function sameBytes(asset, source) {
  const entry = entries.get(asset);
  if (!entry) throw new Error(`${asset} missing`);
  if (!readZipEntry(bytes, entry).equals(readFileSync(source))) {
    throw new Error(`${asset} differs from ${source.slice(ROOT.length + 1)}`);
  }
}

// --payloads '{"opencode":"required"}': which native kinds' staged payloads
// the audit requires; any kind left out is optional.
function parsePayloads(text) {
  if (text === undefined) return {};
  let gates;
  try {
    gates = JSON.parse(text);
  } catch {
    usage(`--payloads is not JSON: ${text}`);
  }
  if (typeof gates !== 'object' || gates === null || Array.isArray(gates)) usage('--payloads must be a JSON object');
  const natives = KINDS.filter((k) => k.type === 'native').map((k) => k.id);
  for (const [id, gate] of Object.entries(gates)) {
    if (!natives.includes(id)) usage(`--payloads names ${id}, which is not a native agent kind (${natives.join(', ')})`);
    if (!['required', 'optional'].includes(gate)) usage(`--payloads ${id} must be required|optional`);
  }
  return gates;
}

function check(name, fn) {
  try {
    results.push({ name, ok: true, detail: fn() ?? 'ok' });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}

function same(actual, want) {
  if (actual !== want) throw new Error(`${actual ?? 'missing'}, expected ${want}`);
  return actual;
}

function parseBadging(text) {
  const attr = (line, key) => line?.match(new RegExp(`${key}='([^']*)'`))?.[1];
  const pkg = text.match(/^package: .*$/m)?.[0];
  return {
    package: attr(pkg, 'name'),
    versionCode: attr(pkg, 'versionCode'),
    versionName: attr(pkg, 'versionName'),
    minSdk: text.match(/^sdkVersion:'(\d+)'/m)?.[1],
    targetSdk: text.match(/^targetSdkVersion:'(\d+)'/m)?.[1],
    debuggable: /^application-debuggable/m.test(text),
    activity: attr(text.match(/^launchable-activity: .*$/m)?.[0], 'name'),
    permissions: [...text.matchAll(/^uses-permission: name='([^']+)'/gm)].map((m) => m[1]),
    nativeCode: [...(text.match(/^native-code: (.*)$/m)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]),
  };
}

// Minimal ZIP central-directory reader: APKs are plain zips (no zip64 at
// these sizes). The APK signing block sits before the central directory and
// does not move it. Returns name -> { method, csize, usize, offset }.
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`corrupt central directory at ${p}`);
    const nameLen = buf.readUInt16LE(p + 28);
    out.set(buf.toString('utf8', p + 46, p + 46 + nameLen), {
      method: buf.readUInt16LE(p + 10),
      csize: buf.readUInt32LE(p + 20),
      usize: buf.readUInt32LE(p + 24),
      offset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

function readZipEntry(buf, entry) {
  const p = entry.offset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error(`corrupt local header at ${p}`);
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + entry.csize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${entry.method}`);
}

// The newest build-tools that has both aapt and apksigner (aapt is the one
// scripts/apk-audit.mjs parses; newer build-tools may drop it).
function buildTools() {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]
    .filter(Boolean)
    .find((p) => existsSync(join(p, 'build-tools')));
  if (!sdk) usage('set ANDROID_HOME');
  const dir = join(sdk, 'build-tools');
  const version = readdirSync(dir)
    .filter((v) => /^\d+(\.\d+)+$/.test(v))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .find((v) => existsSync(join(dir, v, 'aapt')) && existsSync(join(dir, v, 'apksigner')));
  if (!version) usage(`no build-tools with aapt and apksigner in ${dir}`);
  return { aapt: join(dir, version, 'aapt'), apksigner: join(dir, version, 'apksigner') };
}

function run(cmd, argv) {
  return execFileSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function writeSummary(r) {
  const label = build === 'release' ? 'release shape, throwaway-signed' : 'debug';
  const lines = [
    `### \`${r.channel}\` ${label}: ${r.package ?? '?'} ${r.versionName ?? '?'} (${r.versionCode})`,
    '',
    `\`${r.apk}\`: **${mib(r.bytes)}**, SHA-256 \`${r.sha256}\`, minSdk ${r.minSdk}, targetSdk ${r.targetSdk}`,
    '',
    '| Part | In APK | Uncompressed | Files |',
    '| --- | ---: | ---: | ---: |',
    ...r.abis.map((a) => `| \`lib/${a.abi}\` | ${mib(a.compressed)} | ${mib(a.uncompressed)} | ${a.files} |`),
    `| dex | | ${mib(r.dexBytes)} | ${dex.length} |`,
    `| JS bundle | | ${r.bundleBytes ? mib(r.bundleBytes) : 'none'} | ${r.bundleBytes ? 1 : 0} |`,
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...r.checks.map((c) => `| ${c.name} | ${c.ok ? 'ok' : '**FAIL**'} | ${String(c.detail).replace(/\|/g, '\\|')} |`),
    '',
  ];
  const text = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  else process.stdout.write(text);
}

function mib(n) {
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const m = argv[i].match(/^--([a-z0-9-]+)(?:=(.*))?$/);
    if (!m) usage(`unexpected argument ${argv[i]}`);
    out[m[1]] = m[2] ?? argv[(i += 1)];
  }
  return out;
}

function usage(message) {
  console.error(`audit-apk: ${message}`);
  console.error(
    'usage: audit-apk.mjs --apk <file> --channel lite|full|play --build debug|release --abis <a,b> ' +
      "[--cert-sha256 <hex>] [--payloads '{\"<id>\":\"required|optional\"}'] " +
      '[--proot required|optional] [--image required|optional] [--json <file>]',
  );
  process.exit(2);
}
