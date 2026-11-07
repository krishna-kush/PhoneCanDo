// Is the Default env image staged for full and lite exactly the one
// lre/images/default/lock.json locks, from a green lre-image run whose
// linux-image-<version> release holds its GPL sources? Pure: the staged
// files and lock.json (io/linux.mjs), check.sh's answer and GitHub's
// (io/gh.mjs) in, a gate verdict out.
//
// The lock's own rules (fields, release and asset names, the release
// existing as a prerelease that is not latest, its manifest naming this
// sha256, version and run) are lre/images/default/lock/check.sh --locked
// --remote's; we run it rather than repeat them. What it leaves to us: the
// staged bytes equal the lock, the run finished green, and the release holds
// the GPL source bundle. A local image (stage.sh --local) goes to
// dev-assets/, which only debug builds carry; staged for a release it is
// refused like any image the lock does not name.

export const IMAGE_WORKFLOW = '.github/workflows/lre-image.yml';
export const LOCK_CHECK = 'lre/images/default/lock/check.sh --locked --remote';
const LOCK = 'lre/images/default/lock.json';
const STAGE_HINT = './manage image fetch && ./manage image stage';

const short = (sha) => String(sha ?? '?').slice(0, 12);

/** lock.json text -> { locked: false } (every field null), { locked: true, ...fields } or { error }. */
export function parseLock(text) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch (error) {
    return { error: `${LOCK} is not JSON: ${error.message}` };
  }
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) return { error: `${LOCK} is not an object` };
  if (Object.values(lock).every((value) => value === null)) return { locked: false };
  const { version, release, repo, sha256, size, run_id: runId, asset } = lock;
  return { locked: true, version, release, repo, sha256, size, runId, asset };
}

/** Does the staged dir hold anything at all? */
export const imageStaged = (staged) => Boolean(staged.rootfs || staged.info !== null);

/**
 * staged:  { rootfs: { size, sha256 } | null, info: image.json text | null,
 *            infoSha256: its sha256 | null, dev: bool }
 * lock:    parseLock's result
 * check:   check.sh's { status: 0 | 1 | 3, output }, or undefined when not run
 * run:     io/gh.mjs runState for the lock's run, or undefined when not asked
 * release: io/gh.mjs releaseState for the lock's release, or undefined
 * -> { ok, summary, detail, staged } where staged is
 *    { version, sha256, release, info: image.json's sha256 } when the image
 *    ships, else null.
 */
export function imageVerdict({ staged, lock, check, run, release }, { withoutLinux = false } = {}) {
  const devNote = staged.dev
    ? ['dev-assets/default-image (a local image) is staged too: debug builds only, never in a release APK']
    : [];
  if (lock.error) return refuse([lock.error], devNote);

  if (!imageStaged(staged)) {
    if (withoutLinux) {
      return { ok: true, summary: 'not staged; --without-linux: full and lite ship no Default image', detail: devNote, staged: null };
    }
    const how = lock.locked
      ? `${STAGE_HINT}, or pass --without-linux`
      : `${LOCK} locks nothing yet: ./manage image lock <run-id>, then ${STAGE_HINT}; or pass --without-linux`;
    return refuse([`no Default image staged: full and lite must ship Linux (${how})`], devNote);
  }

  const problems = [];
  if (!staged.rootfs) problems.push(`default-image/rootfs.tar.xz is missing next to image.json; ${STAGE_HINT}`);
  let info = null;
  if (staged.info === null) {
    problems.push(`default-image/image.json is missing next to rootfs.tar.xz; ${STAGE_HINT}`);
  } else {
    try {
      info = JSON.parse(staged.info);
    } catch {
      problems.push(`default-image/image.json is not JSON; ${STAGE_HINT}`);
    }
  }
  if (info?.local === true) {
    problems.push('the staged image is a local, unlocked build (stage --local); a release ships only the locked one');
  }

  if (!lock.locked || check?.status === 3) {
    problems.push(`${LOCK} locks no image, so the staged one is unlocked: ./manage image lock <run-id>, then ${STAGE_HINT}`);
    return refuse(problems, devNote);
  }
  if (check?.status !== 0) {
    problems.push(`${LOCK_CHECK} failed: ${check?.output || 'not run'}`);
    return refuse(problems, devNote);
  }

  if (info && (info.sha256 !== lock.sha256 || info.version !== lock.version || info.release !== lock.release)) {
    problems.push(
      `image.json names ${info.version ?? '?'} (sha256 ${short(info.sha256)}), ` +
        `lock.json locks ${lock.version} (sha256 ${short(lock.sha256)}); ${STAGE_HINT}`,
    );
  }
  if (staged.rootfs && (staged.rootfs.sha256 !== lock.sha256 || staged.rootfs.size !== lock.size)) {
    problems.push(
      `rootfs.tar.xz is not the locked image: sha256 ${short(staged.rootfs.sha256)}, ${staged.rootfs.size} bytes; ` +
        `lock.json: ${short(lock.sha256)}, ${lock.size} bytes; ${STAGE_HINT}`,
    );
  }
  problems.push(...runProblems(lock, run), ...sourceProblems(lock, release));
  if (problems.length) return refuse(problems, devNote);

  return {
    ok: true,
    summary: `Default image ${lock.version} is the locked one (sha256 ${short(lock.sha256)}), lre-image run ${lock.runId} green, sources in ${lock.release}`,
    detail: devNote,
    staged: { version: lock.version, sha256: lock.sha256, release: lock.release, info: staged.infoSha256 },
  };
}

// The lock names the run that built and published the image: our image
// workflow, finished green (lock.sh checked it once; a rerun can turn it red).
function runProblems(lock, run) {
  if (run === undefined) return ['the lock\'s lre-image run was not looked up'];
  if (run === 'missing') return [`lock.json's run ${lock.runId} does not exist in ${lock.repo}`];
  if (run.path !== IMAGE_WORKFLOW) return [`lock.json's run ${lock.runId} is ${run.path}, not ${IMAGE_WORKFLOW}`];
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    const state = run.status === 'completed' ? run.conclusion : run.status;
    return [`lock.json's lre-image run ${lock.runId} is ${state}, not green (${run.url ?? 'no url'})`];
  }
  return [];
}

// The image's GPL sources are published with its own release, not the
// app's: the source bundle lre/images/default/gpl/pack.py writes
// (<name>-sources-NN.tar and <name>-sources-index.tsv) must be there.
function sourceProblems(lock, release) {
  if (release === undefined) return [`${lock.release} was not looked up`];
  if (release === 'missing') return [`${lock.repo} has no published release ${lock.release}; it carries the image's GPL sources`];
  const base = `phonecando-linux-default-${lock.version}-sources`;
  const names = new Set(release.assets.map((asset) => asset.name));
  const parts = [...names].filter((name) => name.startsWith(`${base}-`) && /-\d{2}\.tar$/.test(name));
  if (parts.length && names.has(`${base}-index.tsv`)) return [];
  return [`${lock.release} holds no GPL source bundle (${base}-NN.tar and ${base}-index.tsv)`];
}

function refuse([first, ...rest], devNote) {
  return { ok: false, summary: first, detail: [...rest, ...devNote], staged: null };
}

/**
 * The preflight gate. ctx.linux reads the staged files and lock.json and
 * runs check.sh (io/linux.mjs); ctx.gh asks GitHub about the lock's run and
 * release (read-only). The remote checks run only when an image is staged
 * and check.sh passed.
 */
export function imageGate(ctx, state) {
  const staged = ctx.linux.image();
  const lock = parseLock(ctx.linux.lock());
  const remote = {};
  if (imageStaged(staged) && lock.locked) {
    remote.check = ctx.linux.checkLock();
    if (remote.check.status === 0) {
      remote.run = ctx.gh.runState(lock.repo, lock.runId);
      remote.release = ctx.gh.releaseState(lock.repo, lock.release);
    }
  }
  const verdict = imageVerdict({ staged, lock, ...remote }, { withoutLinux: ctx.withoutLinux });
  state.image = verdict.staged;
  return { id: 'image', title: 'Image', overridable: false, ok: verdict.ok, summary: verdict.summary, detail: verdict.detail };
}
