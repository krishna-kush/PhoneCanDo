// Campaign links (https://phonecando.app/?c=<tag>): the rules for an entry in
// the D1 table `campaigns` (migration 0006), the list the Worker counts by
// (a tag not in it is never counted). Pure: text in, data out; a bad line
// stops ./manage before cf is called.
import { die } from './errors.mjs';

/** A campaign tag: 1 to 24 lowercase letters, digits or dashes. */
export const TAG = /^[a-z0-9-]{1,24}$/;

/** The link a campaign hands out. */
export const campaignLink = (tag) => `https://phonecando.app/?c=${tag}`;

/** { tag, note } from the command line, the note trimmed; a usage error for a bad tag or no note. */
export function checkCampaign({ tag, note }) {
  if (!TAG.test(tag ?? '')) die(`campaign tag '${tag}' must be 1 to 24 lowercase letters, digits or dashes`);
  const text = String(note ?? '').trim();
  if (!text) die('a campaign needs a note: ./manage campaign add <tag> "<note>"');
  // Why: both go to cf as --params values, and cf would read a leading '-' as an option.
  if (tag.startsWith('-') || text.startsWith('-')) die("a campaign's tag and note cannot start with '-'");
  return { tag, note: text };
}

/** The list's lines: tag, note, day added and link, in columns. */
export function campaignLines(rows, { bold = (s) => s, dim = (s) => s } = {}) {
  const tw = Math.max(...rows.map((c) => String(c.tag).length));
  const nw = Math.max(...rows.map((c) => String(c.note ?? '').length));
  return rows.map((c) => `${bold(String(c.tag).padEnd(tw))}  ${String(c.note ?? '').padEnd(nw)}  ${dim(`added ${c.added ?? '?'}`)}  ${campaignLink(c.tag)}`);
}
