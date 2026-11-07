#!/usr/bin/env node
// CI audit for one channel APK built by .github/workflows/android.yml:
//   node .github/ci/android/audit-apk.mjs --apk <file> --channel lite|full|play
//     --build debug|release --abis arm64-v8a[,x86_64]
//     [--cert-sha256 <hex>] [--engine required|optional]
//     [--proot required|optional] [--image required|optional] [--json <out.json>]
// Reuses the release gate (scripts/apk-audit.mjs) where it applies to a CI
// build: the channel audit always; the signer check against the run's
// throwaway key (the real release key never reaches CI); the engine check
// only when the payload was staged (it is not in git). On top of that it
// checks what the config plugins and Gradle wiring promise in the built
// artifact: package id, version, ABI list, JS bundle, per-channel agent
// config and manifest attributes. Every check runs; a markdown report goes to
// $GITHUB_STEP_SUMMARY (stdout when unset) and the exit code is 1 if any failed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { auditChannel, checkEngine, checkSigner, ENGINE_LIBS } from '../../../scripts/apk-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RUNNER = join(ROOT, 'app/modules/phonecando-runner');
const CHANNELS = ['full', 'lite', 'play'];
const PTY_LIB = 'libphonecando_pty.so';
// The Linux runtime (app/modules/phonecando-linux): our launcher is built on
// every ABI; proot and its loader are staged for arm64 only.
const LINUX_LAUNCHER = 'libphonecando_launch.so';
const PROOT_LIBS = ['libproot.so', 'libproot-loader.so'];
const BUNDLE = 'assets/index.android.bundle';
// Every agent kind's config as phonecando-runner's syncAgentConfig packages
// it: only full ships the full-only part; the other channels swap in the
// lite overlay's AGENTS.md.
const AGENT_CONFIGS = [
  {
    assets: 'assets/oc-config',
    full: 'agents/oc/config',
    lite: 'agents/oc/config-lite',
    required: 'opencode.json',
    // Phone-control code: the automation plugin and the generic tools'
    // control/ part (agents/shared/phone-tools, packaged as phone-tools/).
    fullOnly: ['plugins/automation/', 'phone-tools/control/'],
  },
];

const args = parseArgs(process.argv.slice(2));
const apk = resolve(args.apk ?? usage('--apk is required'));
const channel = args.channel;
const build = args.build;
if (!CHANNELS.includes(channel)) usage(`--channel must be one of ${CHANNELS.join('|')}`);
if (!['debug', 'release'].includes(build)) usage('--build must be debug|release');
const abis = (args.abis ?? usage('--abis is required')).split(',').map((a) => a.trim()).filter(Boolean);
const engine = args.engine ?? 'optional';
if (!['required', 'optional'].includes(engine)) usage('--engine must be required|optional');
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
  const notes = [];
  for (const cfg of AGENT_CONFIGS) {
    if (!entries.has(`${cfg.assets}/${cfg.required}`)) throw new Error(`${cfg.assets}/${cfg.required} missing`);
    const names = [...entries.keys()];
    const shipped = cfg.fullOnly.filter((dir) => names.some((n) => n.startsWith(`${cfg.assets}/${dir}`)));
    const lacking = cfg.fullOnly.filter((dir) => !shipped.includes(dir));
    if (channel === 'full' && lacking.length) throw new Error(`full lacks ${lacking.map((d) => `${cfg.assets}/${d}`).join(', ')}`);
    if (channel !== 'full' && shipped.length) throw new Error(`${channel} ships ${shipped.map((d) => `${cfg.assets}/${d}`).join(', ')}`);
    const fullOnly = shipped.length > 0;
    const agents = entries.get(`${cfg.assets}/AGENTS.md`);
    if (!agents) throw new Error(`${cfg.assets}/AGENTS.md missing`);
    const source = join(RUNNER, channel === 'full' ? cfg.full : cfg.lite, 'AGENTS.md');
    if (!readZipEntry(bytes, agents).equals(readFileSync(source))) {
      throw new Error(`${cfg.assets}/AGENTS.md differs from ${source.slice(ROOT.length + 1)}`);
    }
    notes.push(`${basename(cfg.assets)}: ${channel === 'full' ? 'full' : 'lite'} AGENTS.md${fullOnly ? ` + ${shipped.join(' + ')}` : ''}`);
  }
  return notes.join('; ');
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
check('engine payload', () => {
  if (engine === 'required') {
    checkEngine(apk);
    return 'staged, non-empty';
  }
  const present = ENGINE_LIBS.filter((lib) => entries.has(lib));
  if (!present.length) return 'not staged (not in git); gate skipped';
  return `${present.length === ENGINE_LIBS.length ? 'present' : `partly present (${present.join(', ')})`}, not gated`;
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
  return `launcher on ${abis.join(', ')}; proot ${proot.length ? 'staged' : 'not staged, not gated'}`;
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
      '[--cert-sha256 <hex>] [--engine required|optional] [--json <file>]',
  );
  process.exit(2);
}
