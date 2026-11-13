import { shareLink, type ShareResult } from '../../state/flows/share';
import { SHARE_TITLE, shareMessage } from './copy';

/** Opens the share sheet with our link (tracked when it can be); a sheet that fails to open is ignored. */
export function shareApp(): Promise<ShareResult> {
  return shareLink(SHARE_TITLE, shareMessage);
}
