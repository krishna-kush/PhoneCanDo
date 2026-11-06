// Redaction of device paths and credentials, shared by the server ops (defence
// in depth: error class, message and frames, engine stderr tails, the report
// note and log tail) and the client SDK (before anything is queued). Pure and
// zero-dependency: it is bundled into the Android app through the client.
// Mirrors the native redactor in phonecando-runner.
//
// Paths: a path is consumed whole, up to whitespace or one of '"`()<>[]{},;
// (so `/sdcard/a:b/c` cannot leak `b/c`). A path that starts right after an
// opening quote (" ' `) runs to the matching closing quote on the same line
// instead, spaces included (`'/sdcard/Tax Return 2025.pdf'` -> `'<path>'`); with
// no closing quote on the line, the unquoted rule applies. A trailing
// `:line[:col]` and trailing `.`/`:` punctuation are given back, so stack
// frames still group and point at code. Secrets: credential-shaped values become SECRET_MARK; the
// label in front of them (header name, JSON key, scheme) stays for debugging.
// Every function is idempotent: redacting twice changes nothing.

/** What a redacted path becomes. */
export const PATH_MARK = '<path>';
/** What a redacted credential becomes. */
export const SECRET_MARK = '<secret>';

// Characters that end a path (besides end of input).
const STOP = `\\s'"\`()<>\\[\\]{},;`;
const BODY = `[^${STOP}]*`;
// An encoded path sits in a query value, which `&` ends (a literal `&` in the path would be %26).
const ENCODED_BODY = `[^&${STOP}]*`;
const SEGMENT = `[^/${STOP}]+`;
// A root must end at a segment boundary: `/sdcardx` is not `/sdcard`.
const BOUNDARY = `(?=[/:${STOP}]|$)`;
// Absolute on-device roots that can carry user, account, workspace or package
// names: app data (/data/user/N, /data/user_de/N, /data/data, /data/media/N),
// installed APKs (/data/app), shared storage (/storage/<volume>: emulated/N,
// self/primary, XXXX-XXXX SD cards), /sdcard and mount points (/mnt/<anything>).
const DEVICE_ROOT = `(?:data/user(?:_de)?/\\d+|data/data|data/app|data/media/\\d+|storage/${SEGMENT}|sdcard|mnt/${SEGMENT})`;

// Where a path starts: file:// and content:// URIs, absolute device roots, ~/.
const PATH_START = `(?:(?:file|content)://|/${DEVICE_ROOT}${BOUNDARY}|~/)`;

/**
 * A path right after the opening quote `q`, up to (not including) the
 * matching closing quote on the same line; a backslash escapes the next
 * character, so `\"` inside a JSON string does not end it. Why quotes are
 * special: a quoted path is the one place a path is known to end at the
 * quote rather than at a space (`open '/sdcard/My File.txt'`, JSON values),
 * so its spaces are consumed instead of leaking the rest of the name. The
 * alternatives in the body are disjoint, so a line without a closing quote
 * costs one linear backtrack before the unquoted rule takes over.
 */
function quoted(q: string, start: string): string {
  return `(?<=${q})${start}(?:[^${q}\\\\\\r\\n]|\\\\[^\\r\\n])*(?=${q})`;
}

// Why one regex with alternatives: one left-to-right pass, so an earlier
// replacement can never be re-matched or split by a later rule.
//   1. a quoted path (see quoted()), including the `<path>/...` backstop of
//      rule 4; listed first so it wins over rule 2 at the same position;
//   2. file:// and content:// URIs, absolute device roots and ~/ paths, not
//      starting inside a longer word or path (the lookbehind);
//   3. URL-encoded forms (%2Fdata%2F..., %2Fstorage%2F..., %2Fsdcard,
//      %2Fmnt%2F..., file%3A%2F%2F...), anywhere, since they hide inside
//      query strings;
//   4. a backstop: `<path>/...` is a path whose prefix an upstream redactor
//      replaced while leaving the rest.
// Java/Android file errors end an unquoted path with a known suffix, so a path
// with spaces can be consumed whole up to it:
//   FileNotFoundException: /storage/…/Tax Return 2025.pdf: open failed: ENOENT (…)
//   FileNotFoundException: /sdcard/My File.txt (No such file or directory)
const JAVA_PATH_END = `(?=: open failed:| \\((?:No such file or directory|Permission denied|Is a directory|Read-only file system)\\))`;

const DEVICE_PATH = new RegExp(
  [
    ...['"', "'", '`'].map((q) => quoted(q, `(?:${PATH_START}|<path>/)`)),
    // 1b. an unquoted path ended by a Java file-error suffix (spaces allowed).
    `(?<![\\w./~-])${PATH_START}[^\\r\\n]*?${JAVA_PATH_END}`,
    `(?<![\\w./~-])${PATH_START}${BODY}`,
    `%2F(?:data|storage|mnt)%2F${ENCODED_BODY}`,
    `%2Fsdcard(?=%2F|[&:${STOP}]|$)${ENCODED_BODY}`,
    `(?:file|content)%3A%2F%2F${ENCODED_BODY}`,
    `<path>/${BODY}`,
  ].join('|'),
  'gi',
);

// What a frame keeps after the path: `:line`, `:line:col`, then trailing `.`/`:`
// punctuation (`taxes.pdf: open failed`, `saved to x.jpg.`).
const PATH_TRAILER = /(?::\d+){0,2}[.:]*$/;

/** Replace every device path in `s` with PATH_MARK, keeping a trailing `:line[:col]`. */
export function redactPaths(s: string): string {
  return s.replace(DEVICE_PATH, (match) => PATH_MARK + (PATH_TRAILER.exec(match)?.[0] ?? ''));
}

// Placeholder for a redacted secret while paths are redacted (redactText).
// Why a private-use character: it is not whitespace or a path delimiter, so a
// path that contained a secret (`.../sk-learn-.../salaries.csv`) is still one
// path and is consumed whole; SECRET_MARK's `<` `>` would split it and leak
// the tail. A private-use character in the input is redacted like a secret.
const HOLD = '';
const HOLD_ALL = //g;

// Key names that hold credentials: api_key, api-key, apiKey, token,
// access_token, githubToken, client_secret, password, passwd...
// Why {0,40}: an unbounded prefix makes the scan quadratic on long hyphenated runs.
const SECRET_KEY = `[\\w-]{0,40}(?:api[_-]?key|token|secret|password|passwd)`;

// Authorization / Proxy-Authorization headers, any scheme, in text or JSON.
const AUTH_HEADER = /\b((?:proxy-)?authorization["']?\s*[:=]\s*)(["'`]?)((?:bearer|basic|digest|token|negotiate|ntlm)\s+)?([^\r\n]*)/gi;

/**
 * Keeps the header name, the opening quote and the scheme. A quoted value
 * ends at its closing (unescaped) quote; an unquoted one runs to the end of
 * the line, because header values may contain spaces and quotes (Digest).
 */
function holdAuthValue(_m: string, label: string, quote: string, scheme: string | undefined, rest: string): string {
  const head = label + quote + (scheme ?? '') + HOLD;
  if (!quote) return head;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '\\') i++;
    else if (rest[i] === quote) return head + rest.slice(i);
  }
  return head;
}

/** Credential shapes after AUTH_HEADER, applied in order. `$n` keeps the label in front of the value. */
const SECRET_RULES: readonly (readonly [RegExp, string])[] = [
  // A bare bearer token (8+ token characters, so "bearer token" prose survives).
  [/\b(bearer)\s+[A-Za-z0-9\-._~+/]{8,}=*/gi, `$1 ${HOLD}`],
  // A bare Basic credential (base64); case-sensitive, the HTTP scheme spelling.
  [/\b(Basic)\s+[A-Za-z0-9+/]{8,}={0,2}/g, `$1 ${HOLD}`],
  // OpenAI-style and Anthropic keys: sk-..., sk-proj-..., sk-ant-api03-...
  [/\bsk-[A-Za-z0-9_-]{16,}/g, HOLD],
  // Groq (gsk_) and xAI (xai-) keys.
  [/\b(?:gsk_[A-Za-z0-9]{20,}|xai-[A-Za-z0-9]{20,})/g, HOLD],
  // GitHub tokens: ghp_ (classic), gho_ (OAuth), ghu_/ghs_/ghr_, github_pat_ (fine-grained).
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, HOLD],
  // Slack tokens: xoxa-, xoxb-, xoxp-, xoxo-, xoxs-, xoxr-.
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, HOLD],
  // AWS access key ids (long-lived AKIA, temporary ASIA).
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, HOLD],
  // Google API keys.
  [/\bAIza[0-9A-Za-z_-]{30,}/g, HOLD],
  // JSON string values under a credential key: "api_key": "...", "password":"...".
  [new RegExp(`("${SECRET_KEY}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'gi'), `$1"${HOLD}"`],
  // key=value forms: query strings (?access_token=...), env lines, CLI flags.
  // `<` ends the value, so an already redacted `token=<secret>` is left as it is.
  [new RegExp(`\\b(${SECRET_KEY})=[^\\s&"'\`()<>\\[\\]{},;]+`, 'gi'), `$1=${HOLD}`],
];

/** Every credential in `s` replaced with HOLD. */
function holdSecrets(s: string): string {
  let out = s.replace(AUTH_HEADER, holdAuthValue);
  for (const [re, replacement] of SECRET_RULES) out = out.replace(re, replacement);
  return out;
}

/** Replace credential-shaped values in `s` with SECRET_MARK. */
export function redactSecrets(s: string): string {
  return holdSecrets(s).replace(HOLD_ALL, SECRET_MARK);
}

/**
 * Secrets, then paths, then the held secrets become SECRET_MARK. Secrets go
 * first so a credential that spans a path delimiter (an Authorization line, a
 * `token=` query value) is caught whole; holding them as a path character
 * keeps a path that contained one in one piece (see HOLD).
 */
export function redactText(s: string): string {
  return redactPaths(holdSecrets(s)).replace(HOLD_ALL, SECRET_MARK);
}
