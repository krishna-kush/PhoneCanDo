// How old the Default image a release ships is: the date of the Debian
// snapshot its packages come from, which its version starts with
// (lock/check.sh holds the two equal). Never a refusal: the release says it,
// shows the run that publishes a fresher image, and asks. Pure: the version
// and today in, lines out.

export const REPUBLISH = 'gh workflow run lre-image.yml --ref prod -f publish=true -f fresh=true';

/** version 'YYYYMMDD-<hash>', now (a Date) -> { days, lines }, or null when the version has no date. */
export function imageAge(version, now) {
  const match = /^(\d{4})(\d{2})(\d{2})-/.exec(version ?? '');
  if (!match) return null;
  const [, year, month, day] = match;
  const built = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const days = Math.max(0, Math.floor((now.getTime() - built) / 86_400_000));
  return {
    days,
    lines: [
      `Default image ${version}: Debian packages from ${year}-${month}-${day}, ${days} day(s) old.`,
      `For newer packages, publish a fresh one: ${REPUBLISH}`,
      '  then ./manage image lock <run-id>, commit lock.json, ./manage image fetch && ./manage image stage, and release again.',
    ],
  };
}
