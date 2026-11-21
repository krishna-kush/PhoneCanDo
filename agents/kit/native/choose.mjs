// Where a kind's payload comes from, in our order: the staged one when it is
// current, else GitHub's build of these sources, else a build on this PC.
// Pure: the kind's state in, the offered actions and the default out.
//
// A release prefers GitHub's build over a current one built on this PC, when
// GitHub has one: that is the build CI's own APK checks ran with.

export const LOCAL_SOURCE = 'built on this PC';

/**
 * kind: {
 *   id
 *   staged   state.mjs stagedState(...)
 *   builds   github.mjs builds(...) ([] when none), or null when gh could not ask
 * }
 * opts: { rebuild: Set<id>, download: Set<id>, release: boolean }
 * -> { actions: [{ action: 'keep' | 'download' | 'build', build? }], pick: index | -1, note? }
 *    pick -1: nothing can satisfy what was asked (note says why)
 */
export function choose(kind, { rebuild = new Set(), download = new Set(), release = false } = {}) {
  const current = kind.staged.state === 'current';
  const newest = kind.builds?.[0];
  const actions = [];
  if (current && !rebuild.has(kind.id) && !download.has(kind.id)) actions.push({ action: 'keep' });
  if (newest && !rebuild.has(kind.id)) actions.push({ action: 'download', build: newest });
  if (!download.has(kind.id)) actions.push({ action: 'build' });
  const at = (action) => actions.findIndex((a) => a.action === action);

  if (rebuild.has(kind.id)) return { actions, pick: at('build') };
  if (download.has(kind.id)) {
    return newest
      ? { actions, pick: at('download') }
      : { actions, pick: -1, note: kind.builds === null ? 'GitHub could not be asked' : 'GitHub has no trusted build of these sources' };
  }
  if (current) {
    const local = (kind.staged.source ?? '').startsWith(LOCAL_SOURCE);
    if (release && local && newest) return { actions, pick: at('download'), note: 'the staged payload was built on this PC, not by CI' };
    return { actions, pick: at('keep') };
  }
  return { actions, pick: newest ? at('download') : at('build') };
}
