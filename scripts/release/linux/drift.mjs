// Is the proot we build the newest upstream has? A pin behind termux/proot
// is not refused (a bump is a change of its own, lre/proot/pins.env), but
// the release says how far behind it is and asks before it builds. Pure:
// the pins and io/gh.mjs's upstreamLag come in, lines out.

/**
 * pins { PROOT_REPO, PROOT_COMMIT, PROOT_VERSION }, lag { branch, newer,
 * offBranch } -> null when the pin is the branch's head, else
 * { newer, lines } to print.
 */
export function prootDrift(pins, lag) {
  if (lag.newer === 0 && lag.offBranch === 0) return null;
  const repo = pins.PROOT_REPO;
  const lines = [];
  if (lag.newer > 0) {
    lines.push(
      `proot is ${lag.newer} change(s) behind ${repo} ${lag.branch}: we build ${pins.PROOT_VERSION} ` +
        `(${pins.PROOT_COMMIT.slice(0, 12)}).`,
    );
  }
  if (lag.offBranch > 0) lines.push(`${lag.offBranch} change(s) in our pin are no longer on ${repo} ${lag.branch}.`);
  lines.push(`What changed: https://github.com/${repo}/compare/${pins.PROOT_COMMIT}...${lag.branch}`);
  return { newer: lag.newer, lines };
}
