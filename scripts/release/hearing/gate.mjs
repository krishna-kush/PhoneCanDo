// The preflight's second-opinion row: has code a reviewer cares about
// changed since the commit the site's three AI rulings were asked about?
// Never refuses a release; when it has, the row is marked to ask again.
// Pure: the pin (web/src/data/secondOpinion.json) and git come in.

import { trustChanges } from './trust.mjs';

const short = (sha) => sha.slice(0, 7);

/**
 * hearing: { version, commit } or null (no pin read: no row);
 * git: io/git.mjs's changedSince; sha: the commit being released.
 * -> a gate: { id, title, ok, overridable, remind, summary, detail? }
 */
export function hearingGate({ hearing, git, sha }) {
  if (!hearing) return null;
  const on = `v${hearing.version} @ ${short(hearing.commit)}`;
  const row = { id: 'hearing', title: 'Opinion', ok: true, overridable: false, remind: false };
  const since = git.changedSince(hearing.commit, sha);
  if (since.state === 'missing') {
    return { ...row, summary: `${on} is not in this clone (shallow, or history rewritten); not checked` };
  }
  if (since.state === 'diverged') {
    return { ...row, remind: true, summary: `${on} is not behind this commit; history moved, pin it again` };
  }
  const areas = trustChanges(since.files);
  if (areas.length === 0) return { ...row, summary: `${on} still holds: no trust paths changed since` };
  const count = areas.reduce((sum, area) => sum + area.files.length, 0);
  return {
    ...row,
    remind: true,
    summary: `${count} file(s) a reviewer checks changed since ${on}; ask the three AIs again (web/src/data/secondOpinion.json)`,
    detail: areas.map((area) => `${area.name}: ${area.files.length} file(s), e.g. ${area.files[0]}`),
  };
}
