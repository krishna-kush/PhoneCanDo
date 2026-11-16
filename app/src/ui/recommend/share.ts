import { shareLink, type ShareResult } from '../../state/flows/share';
import { SHARE_LINES, SHARE_TITLE, shareMessage } from './copy';

// Which line the share sheet opens with next: a random one at launch, then
// the next one each time the sheet opens, sent or not, so it never shows
// the same line twice in a row.
let turn = Math.floor(Math.random() * SHARE_LINES.length);

/** Opens the share sheet with our link (tracked when it can be) and the next line; a sheet that fails to open is ignored. */
export function shareApp(): Promise<ShareResult> {
  const line = turn++;
  return shareLink(SHARE_TITLE, (link) => shareMessage(link, line));
}
