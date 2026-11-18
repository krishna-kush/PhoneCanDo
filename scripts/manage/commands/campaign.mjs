// campaign: the campaign links we hand out (https://phonecando.app/?c=<tag>),
// listed in the D1 table `campaigns` through the cf CLI (campaigns-d1.mjs).
// add checks the tag is new, adds it (added today, UTC) and prints its link;
// list prints them all. The Worker reads the list on every count, so a new
// campaign counts from the moment it is added: no commit, no push.
import { bold, dim } from '../../terminal/style.mjs';
import { campaignLines, campaignLink, checkCampaign } from '../campaigns.mjs';
import { campaignsD1 } from '../campaigns-d1.mjs';
import { die, stop } from '../errors.mjs';

const USAGE = 'usage: manage campaign add <tag> "<note>" | list';

/** ./manage campaign add|list; tests pass their own `d1` (campaignsD1 with a stub spawn) and `today`. */
export function campaign(args, { d1 = campaignsD1(), today = new Date().toISOString().slice(0, 10) } = {}) {
  if (args[0] === 'add' && args.length === 3) {
    const entry = checkCampaign({ tag: args[1], note: args[2] });
    const listed = d1.find(entry.tag);
    if (listed) stop(`campaign '${entry.tag}' is already listed (added ${listed.added ?? 'on an unknown day'}): pick another tag`);
    d1.add({ ...entry, added: today });
    console.log(`Added campaign ${bold(entry.tag)} to the campaigns list on D1. Its link:`);
    console.log(`  ${campaignLink(entry.tag)}`);
    console.log(dim('It counts from now on: the Worker reads the list on D1, so there is nothing to commit or push.'));
  } else if (args[0] === 'list' && args.length === 1) {
    const rows = d1.list();
    if (!rows.length) {
      console.log('No campaigns yet: ./manage campaign add <tag> "<note>"');
      return;
    }
    for (const line of campaignLines(rows, { bold, dim })) console.log(line);
  } else {
    die(USAGE);
  }
}
