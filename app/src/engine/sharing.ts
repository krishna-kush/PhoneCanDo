// Text out of and into the app: the clipboard (the runner's ClipboardManager
// calls, api/ClipboardFunctions.kt) and Android's share sheet (the runner's
// chooser, api/ShareFunctions.kt, which tells which app was picked; React
// Native's Share on native builds older than it). A custom agent's JSON
// leaves and arrives this way.
import { Share } from 'react-native';
import { nativeRunner } from './runner';

/** False when nothing reached the clipboard. */
export function copyText(text: string): boolean {
  try {
    return nativeRunner().copyText(text);
  } catch {
    return false;
  }
}

/** The clipboard's text; null when it holds none (or the app is not in front). */
export function clipboardText(): string | null {
  try {
    return nativeRunner().clipboardText() ?? null;
  } catch {
    return null;
  }
}

/** How a share sheet ended: whether an app was picked, and its label (stays on the phone). */
export type ShareOutcome = { chosen: boolean; app: string | null };

/** Opens the share sheet with the text; resolves once an app was picked or the sheet closed. */
export async function shareText(text: string, title: string): Promise<ShareOutcome> {
  let runner: ReturnType<typeof nativeRunner> | null = null;
  try {
    runner = nativeRunner();
  } catch {
    runner = null;
  }
  if (typeof runner?.shareChooser === 'function') {
    const r = await runner.shareChooser(text, title);
    return { chosen: r?.chosen === true, app: typeof r?.app === 'string' && r.app ? r.app : null };
  }
  // why chosen: React Native's sheet resolves as it opens, so an older
  // build can't tell a pick from a dismiss; the share counts as sent.
  await Share.share({ message: text, title });
  return { chosen: true, app: null };
}
