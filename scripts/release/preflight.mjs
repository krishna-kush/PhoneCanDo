// Before anything is written or built: is the commit we release clean,
// pushed and green on GitHub, and is the Linux that full and lite will ship
// (proot, the Default image) exactly the verified, locked one? The gates run
// in order, each one that can (a dirty tree still gets its CI table), and
// the verdict says whether the release may go on. No IO of its own: git, gh
// and the staged Linux files come in as objects (io/git.mjs, io/gh.mjs,
// io/linux.mjs), so the tests run all of it on fakes.

import { classifyChecks } from './ci/classify.mjs';
import { imageGate } from './linux/image.mjs';
import { prootGate } from './linux/proot.mjs';
import { dirtyEntries, parsePorcelain } from './worktree.mjs';

/**
 * ctx: {
 *   git, gh          io/git.mjs and io/gh.mjs objects (or fakes)
 *   linux            io/linux.mjs object (or a fake): the staged proot and
 *                    Default image, pins.env and lock.json
 *   repo             owner/name on GitHub
 *   allowDirty       repo-relative paths that may be edited in place
 *                    (--upload-only: the version files the first run bumped)
 *   builtFrom        commit the staged APKs were built from (--upload-only),
 *                    released instead of HEAD
 *   overrides        gate ids allowed to fail (--allow-red-ci: 'ci')
 *   withoutLinux     --without-linux: no proot or image staged is fine
 *                    (whatever is staged is still checked)
 * }
 * -> { head, sha, gates, ci, proot, image, proceed, refusals, overridden, notes }
 *    proot { version, libs: { name: sha256 } } and image { version, sha256,
 *    release, info } describe what ships; null for what does not (or was
 *    refused)
 */
export function runPreflight(ctx) {
  const state = { head: ctx.git.head() };
  state.sha = ctx.builtFrom ?? state.head;
  const gates = GATES.map((gate) => gate(ctx, state)).filter(Boolean);
  return { ...state, gates, ...verdict(gates, ctx.overrides ?? []) };
}

// In order; a gate reads what earlier ones left in `state` and returns
// { id, title, ok, overridable, summary, detail?, overrideNote? } or null when
// it cannot apply. The Linux gates (linux/) never yield to --allow-red-ci.
const GATES = [treeGate, pushedGate, ciGate, prootGate, imageGate];

const short = (sha) => sha.slice(0, 12);

function treeGate(ctx) {
  const dirty = dirtyEntries(parsePorcelain(ctx.git.porcelain()), ctx.allowDirty ?? []);
  const allowed = ctx.allowDirty?.length ? ` (version files may differ: ${ctx.allowDirty.join(', ')})` : '';
  return {
    id: 'tree',
    title: 'Tree',
    ok: dirty.length === 0,
    overridable: false,
    summary: dirty.length
      ? `${dirty.length} uncommitted change(s); commit and push them first`
      : `clean${allowed}`,
    detail: dirty.map((entry) => `${entry.code} ${entry.from ? `${entry.from} -> ` : ''}${entry.path}`),
  };
}

function pushedGate(ctx, state) {
  state.pushed = ctx.gh.commitState(ctx.repo, state.sha) === 'present';
  return {
    id: 'pushed',
    title: 'GitHub',
    ok: state.pushed,
    overridable: false,
    summary: state.pushed
      ? `${ctx.repo} has ${short(state.sha)}`
      : `${ctx.repo} does not have ${short(state.sha)}; push it first`,
  };
}

function ciGate(ctx, state) {
  if (!state.pushed) return null; // GitHub has no checks for a commit it lacks
  state.ci = classifyChecks(ctx.gh.ciState(ctx.repo, state.sha));
  const red = state.ci.blocks.map((row) => `${row.name} (${row.state})`);
  const warned = state.ci.warns.length ? `; ${state.ci.warns.length} warning(s)` : '';
  return {
    id: 'ci',
    title: 'CI',
    ok: red.length === 0,
    overridable: true,
    summary: red.length ? `not green: ${red.join(', ')}${warned}` : `every gate green${warned}`,
    overrideNote: `Released with red CI: ${red.join(', ')}`,
  };
}

/**
 * Failed gates refuse the release unless their id is in `overrides` and they
 * are overridable; an overridden gate's note goes into the release notes.
 */
export function verdict(gates, overrides) {
  const failed = gates.filter((gate) => !gate.ok);
  const overridden = failed.filter((gate) => gate.overridable && overrides.includes(gate.id));
  const refused = failed.filter((gate) => !overridden.includes(gate));
  return {
    proceed: refused.length === 0,
    refusals: refused.map((gate) => `${gate.title}: ${gate.summary}`),
    overridden: overridden.map((gate) => gate.id),
    notes: overridden.map((gate) => gate.overrideNote),
  };
}
