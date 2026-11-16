// What a release calls itself: alpha, beta or nothing (stable). Pure. The
// release title, latest.json and web/src/data/release.json carry it, so the
// site words the release as the release does.

export const LABELS = ['alpha', 'beta', 'stable'];

/** --label as given, stable when left out: 'alpha', 'beta' or null (stable); throws on anything else. */
export function releaseLabel(flag) {
  if (flag !== undefined && !LABELS.includes(flag)) throw new Error(`--label must be one of ${LABELS.join(', ')}`);
  return flag === undefined || flag === 'stable' ? null : flag;
}

/** The GitHub release title: the tag, with the label in brackets when there is one. */
export function releaseTitle(tag, label) {
  return label ? `${tag} (${label})` : tag;
}
