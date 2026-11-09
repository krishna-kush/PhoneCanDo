// Release-gate checks for a built channel APK, shared by build-android.mjs and
// release-android.mjs. Importing this module has no side effects (the build
// script starts a build when loaded, so the checks cannot live there).
// Every check throws on failure, and a check that cannot run fails too: a
// missing tool or an unreadable APK never passes.
import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';
import { nativeManifests } from '../agents/kit/cli/manifests.mjs';

// SHA-256 of the release signing certificate: a public digest, not a secret.
// Set PHONECANDO_RELEASE_CERT_SHA256 to the new digest after a key rotation.
export const RELEASE_CERT_SHA256 =
  'f334c3893832ab660dc15b808c16440d70d52b68ddd7ebd9bf5571598ffd75a0';

// Native agent kinds' libs (agents/native/<id>/agent.json, payload.libs),
// arm64 only. They are built outside git (./manage agent <id> build|stage); a
// fresh clone has none.
export const PAYLOAD_ABI = 'arm64-v8a';

/** The APK paths of a native kind's libs (an entry of agents/kit/cli/manifests.mjs). */
export function payloadLibs(kind) {
  return kind.manifest.payload.libs.map((lib) => `lib/${PAYLOAD_ABI}/${lib.name}`);
}

// Full-only code: the accessibility driver (uiauto), packs and the PCE.
const SERVICE_CLASS = 'Lcom/phonecando/runner/uiauto/PhoneCanDoAccessibilityService;';
const PCE_CLASSES = 'Lcom/phonecando/pce/';
const FULL_ONLY = [PCE_CLASSES, 'Lcom/phonecando/runner/uiauto/', 'Lcom/phonecando/runner/packs/'];

// Signer, channel and payload checks in one call; returns apksigner's report.
export function auditApk(apk, channel, tools) {
  const certs = checkSigner(apk, tools);
  auditChannel(apk, channel, tools);
  checkPayloads(apk, channel);
  console.log(`${basename(apk)}: ${channel} audit OK (release signer, channel, agent payloads)`);
  return certs;
}

export function releaseCertSha256() {
  const raw = process.env.PHONECANDO_RELEASE_CERT_SHA256 || RELEASE_CERT_SHA256;
  const digest = raw.toLowerCase().replace(/[\s:]/g, '');
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error('PHONECANDO_RELEASE_CERT_SHA256 is not a SHA-256 hex digest');
  }
  return digest;
}

// Signed by the release certificate and nothing else; never the debug key.
export function checkSigner(apk, tools, expected = releaseCertSha256()) {
  const certs = tool(tools.apksigner, ['verify', '--print-certs', apk]);
  if (/CN=Android Debug/i.test(certs)) {
    throw new Error(`${basename(apk)} is signed with the Android debug key; release signing was not applied`);
  }
  const digests = [...certs.matchAll(/certificate SHA-256 digest: ([0-9a-f]{64})/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  if (!digests.length) throw new Error(`${basename(apk)}: apksigner printed no signer digest`);
  const foreign = digests.filter((d) => d !== expected);
  if (foreign.length) {
    throw new Error(
      `${basename(apk)} is signed by ${foreign.join(', ')}, not the release certificate ${expected} ` +
        '(after a key rotation, set PHONECANDO_RELEASE_CERT_SHA256)',
    );
  }
  return certs.trim();
}

// What must hold per channel. Lite (and play) is the download that passes
// Play Protect: no accessibility service and no full-only classes. Full is
// the update every lite user is offered: it must declare the service and
// carry its class and the PCE.
export function auditChannel(apk, channel, tools) {
  const name = basename(apk);
  const manifest = tool(tools.aapt, ['dump', 'xmltree', apk, 'AndroidManifest.xml']);
  const declared = manifest.match(
    /"com\.phonecando\.channel"[^\n]*\n[^\n]*android:value\([^)]*\)="([^"]*)"/,
  )?.[1];
  if (declared !== channel) {
    throw new Error(`${name}: channel meta-data is ${declared ?? 'missing'}, expected ${channel}`);
  }
  const hasService = manifest.includes('BIND_ACCESSIBILITY_SERVICE');
  const dex = tool('unzip', ['-p', apk, 'classes*.dex'], { binary: true });
  if (!dex.length) throw new Error(`${name}: no classes*.dex`);
  if (channel === 'full') {
    if (!hasService) throw new Error(`${name}: full declares no accessibility service`);
    if (!dex.includes(SERVICE_CLASS)) throw new Error(`${name}: full dex lacks the accessibility service class`);
    if (!dex.includes(PCE_CLASSES)) throw new Error(`${name}: full dex has no PCE classes`);
  } else {
    if (hasService) throw new Error(`${name}: ${channel} declares an accessibility service`);
    const found = FULL_ONLY.filter((prefix) => dex.includes(prefix));
    if (found.length) throw new Error(`${name}: ${channel} dex contains ${found.join(', ')} classes`);
  }
}

// Every native agent kind the channel lists has its libs packaged and
// non-empty; a kind the channel does not list has none in it.
export function checkPayloads(apk, channel) {
  const sizes = new Map();
  for (const line of tool('unzip', ['-l', apk]).split('\n')) {
    const row = line.match(/^\s*(\d+)\s+\S+\s+\S+\s+(.+?)\s*$/);
    if (row) sizes.set(row[2], Number(row[1]));
  }
  const problems = payloadProblems(sizes, channel, nativeManifests());
  if (problems.length) {
    throw new Error(`${basename(apk)}: ${problems.join('; ')}; stage the payloads first (./manage agent <id> stage)`);
  }
}

/**
 * What checkPayloads finds wrong, from the APK's entry sizes (path -> bytes):
 * a listed kind's lib missing or empty, or an unlisted kind's lib on any ABI.
 */
export function payloadProblems(sizes, channel, kinds) {
  const problems = [];
  for (const kind of kinds) {
    const listed = kind.manifest.channels.includes(channel);
    for (const lib of payloadLibs(kind)) {
      if (listed && !(sizes.get(lib) > 0)) {
        problems.push(`${lib} (${kind.id}) is ${sizes.has(lib) ? 'empty' : 'missing'}`);
      }
      if (!listed) {
        const stray = [...sizes.keys()].filter((n) => n.startsWith('lib/') && basename(n) === basename(lib));
        if (stray.length) problems.push(`${stray.join(', ')} ships, but ${kind.id} does not list ${channel}`);
      }
    }
  }
  return problems;
}

function tool(cmd, args, { binary = false } = {}) {
  const r = spawnSync(cmd, args, {
    encoding: binary ? 'buffer' : 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const label = `${basename(cmd)} ${args[0]}`;
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`${label} exited ${r.status ?? r.signal}: ${String(r.stderr).trim()}`);
  }
  return r.stdout;
}
