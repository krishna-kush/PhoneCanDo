import { shareText } from '../../engine/sharing';
import { SHARE_TEXT, SHARE_TITLE } from './copy';

/** Opens the share sheet with PhoneCanDo's link; a sheet that fails to open is ignored. */
export async function shareApp(): Promise<void> {
  try {
    await shareText(SHARE_TEXT, SHARE_TITLE);
  } catch {
    // no share sheet: nothing to do
  }
}
