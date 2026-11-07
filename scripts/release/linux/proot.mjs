// Is the proot staged for full and lite the verified build of our pins?
// Pure: what io/linux.mjs read from the staged libs dir in, a gate verdict
// out. The build is not rerun here (it needs the NDK); what we can check
// without it: both libs there, byte-equal to the SHA256SUMS that
// lre/proot/verify.sh wrote after its ELF checks (lre/proot/stage.sh copies
// it next to the libs), and libproot.so built as the PROOT_VERSION in
// lre/proot/pins.env (build-android.sh compiles that string in).

export const PROOT_LIBS = ['libproot.so', 'libproot-loader.so'];

/** KEY=value lines (lre/proot/pins.env) -> { KEY: value }; comments and blanks skipped. */
export function parsePins(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

/** `sha256sum` output -> Map(name -> sha256); null when a line is not "<64 hex>  <name>". */
export function parseSums(text) {
  const sums = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^([0-9a-f]{64}) [ *](\S+)$/);
    if (!match || sums.has(match[2])) return null;
    sums.set(match[2], match[1]);
  }
  return sums;
}

const short = (sha) => sha.slice(0, 12);

/**
 * staged: {
 *   libs     { 'libproot.so': { size, sha256 } | null, 'libproot-loader.so': ... }
 *   sums     SHA256SUMS text next to the libs, or null
 *   version  PROOT_VERSION from pins.env
 *   marked   libproot.so carries that version string
 * }
 * -> { ok, summary, detail, staged } where staged is
 *    { version, libs: { name: sha256 } } when proot ships, else null.
 */
export function prootVerdict(staged, { withoutLinux = false } = {}) {
  const present = PROOT_LIBS.filter((name) => staged.libs[name]?.size > 0);
  if (present.length === 0) {
    return withoutLinux
      ? { ok: true, summary: 'not staged; --without-linux: full and lite ship no proot', detail: [], staged: null }
      : refuse([
          'not staged: full and lite must ship Linux (lre/proot/stage.sh <dir>, or pass --without-linux)',
        ]);
  }

  const problems = [];
  for (const name of PROOT_LIBS) {
    if (!present.includes(name)) problems.push(`${name} is missing or empty next to the other lib; restage with lre/proot/stage.sh`);
  }
  if (staged.sums === null) {
    problems.push('no SHA256SUMS next to the staged libs (lre/proot/stage.sh copies verify.sh\'s); restage');
  } else {
    const sums = parseSums(staged.sums);
    const listed = sums ? [...sums.keys()].sort() : [];
    if (!sums || listed.join(' ') !== [...PROOT_LIBS].sort().join(' ')) {
      problems.push(`SHA256SUMS next to the libs must list exactly ${PROOT_LIBS.join(' and ')}; restage`);
    } else {
      for (const name of present) {
        const actual = staged.libs[name].sha256;
        if (sums.get(name) !== actual) {
          problems.push(`${name} is not the verified build: sha256 ${short(actual)}, SHA256SUMS says ${short(sums.get(name))}; restage`);
        }
      }
    }
  }
  if (!staged.version) {
    problems.push('lre/proot/pins.env has no PROOT_VERSION');
  } else if (present.includes('libproot.so') && !staged.marked) {
    problems.push(`libproot.so is not proot ${staged.version} (lre/proot/pins.env): a stale build; rebuild and restage`);
  }
  if (problems.length) return refuse(problems);

  const libs = Object.fromEntries(PROOT_LIBS.map((name) => [name, staged.libs[name].sha256]));
  return {
    ok: true,
    summary: `proot ${staged.version} staged, matches its SHA256SUMS (${PROOT_LIBS.map((n) => `${n} ${short(libs[n])}`).join(', ')})`,
    detail: [],
    staged: { version: staged.version, libs },
  };
}

function refuse([first, ...rest]) {
  return { ok: false, summary: first, detail: rest, staged: null };
}

/** The preflight gate: ctx.linux.proot() is io/linux.mjs's reader (or a fake). */
export function prootGate(ctx, state) {
  const verdict = prootVerdict(ctx.linux.proot(), { withoutLinux: ctx.withoutLinux });
  state.proot = verdict.staged;
  return { id: 'proot', title: 'proot', overridable: false, ok: verdict.ok, summary: verdict.summary, detail: verdict.detail };
}
