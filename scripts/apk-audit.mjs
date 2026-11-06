// Release-gate checks for a built channel APK, shared by build-android.mjs and
// release-android.mjs. Importing this module has no side effects (the build
// script starts a build when loaded, so the checks cannot live there).
// Every check throws on failure, and a check that cannot run fails too: a
// missing tool or an unreadable APK never passes.
import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

// SHA-256 of the release signing certificate: a public digest, not a secret.
// Set PHONECANDO_RELEASE_CERT_SHA256 to the new digest after a key rotation.
export const RELEASE_CERT_SHA256 =
  'f334c3893832ab660dc15b808c16440d70d52b68ddd7ebd9bf5571598ffd75a0';

// Every bundled agent kind's engine libraries. They are built outside git
// (opencode: docs/bootstrap/); a fresh clone has none.
const AGENT_ENGINE_LIBS = {
  oc: ['lib/arm64-v8a/liboc-engine.so', 'lib/arm64-v8a/liboc-opentui.so'],
};
export const ENGINE_LIBS = Object.values(AGENT_ENGINE_LIBS).flat();

// Full-only code: the accessibility driver (uiauto), packs and the PCE.
const SERVICE_CLASS = 'Lcom/phonecando/runner/uiauto/PhoneCanDoAccessibilityService;';
const PCE_CLASSES = 'Lcom/phonecando/pce/';
const FULL_ONLY = [PCE_CLASSES, 'Lcom/phonecando/runner/uiauto/', 'Lcom/phonecando/runner/packs/'];

// Signer, channel and engine checks in one call; returns apksigner's report.
export function auditApk(apk, channel, tools) {
  const certs = checkSigner(apk, tools);
  auditChannel(apk, channel, tools);
  checkEngine(apk);
  console.log(`${basename(apk)}: ${channel} audit OK (release signer, channel, engine)`);
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

// Every engine library is packaged and non-empty.
export function checkEngine(apk) {
  const sizes = new Map();
  for (const line of tool('unzip', ['-l', apk]).split('\n')) {
    const row = line.match(/^\s*(\d+)\s+\S+\s+\S+\s+(.+?)\s*$/);
    if (row) sizes.set(row[2], Number(row[1]));
  }
  for (const lib of ENGINE_LIBS) {
    if (!(sizes.get(lib) > 0)) {
      throw new Error(
        `${basename(apk)}: ${lib} is ${sizes.has(lib) ? 'empty' : 'missing'}; stage the engine first (docs/bootstrap/README.md)`,
      );
    }
  }
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
