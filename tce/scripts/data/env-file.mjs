// Local secrets for scripts/data.mjs: the repo-root .env (gitignored, mode
// 600; it also holds the release signing settings the Android scripts source
// with bash), or the file PHONECANDO_RELEASE_ENV names. Only the keys asked
// for are read: nothing else in the file enters this process, and no value is
// ever printed. The real environment wins over the file.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What data.mjs takes from the file. */
export const ENV_KEYS = ['TCE_READ_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];

/** The env file: PHONECANDO_RELEASE_ENV (./manage sets it), else <root>/.env. */
export const envFilePath = (env, root) => env.PHONECANDO_RELEASE_ENV || join(root, '.env');

/** The inside of a double-quoted shell value: up to the first unescaped quote, with \" \\ \$ \` unescaped. */
function doubleQuoted(v) {
  let out = '';
  for (let i = 1; i < v.length; i++) {
    const c = v[i];
    if (c === '"') break;
    if (c === '\\' && '"\\$`'.includes(v[i + 1] ?? '')) out += v[++i];
    else out += c;
  }
  return out;
}

/**
 * `keys` from shell-style KEY=value lines (what `set -a; source` accepts:
 * optional `export`, single or double quotes, `#` comments). A later line
 * wins, as in the shell.
 */
export function parseEnvFile(text, keys) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(raw);
    if (!m || !keys.includes(m[1])) continue;
    let v = m[2].trim();
    if (v.startsWith('"')) v = doubleQuoted(v);
    else if (v.startsWith("'")) v = v.slice(1, v.indexOf("'", 1) < 0 ? undefined : v.indexOf("'", 1));
    else v = v.replace(/\s+#.*$/, '').trim();
    out[m[1]] = v;
  }
  return out;
}

/** The environment with ENV_KEYS filled in from the env file where unset (a missing file adds nothing). */
export function withEnvFile(env, root) {
  let text;
  try {
    text = readFileSync(envFilePath(env, root), 'utf8');
  } catch {
    return env;
  }
  const fromFile = parseEnvFile(text, ENV_KEYS);
  const merged = { ...env };
  for (const [k, v] of Object.entries(fromFile)) if (!merged[k] && v) merged[k] = v;
  return merged;
}
