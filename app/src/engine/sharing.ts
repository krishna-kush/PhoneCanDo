// Text out of and into the app: the clipboard (the runner's ClipboardManager
// calls, api/ClipboardFunctions.kt) and Android's share sheet (React
// Native's Share). A custom agent's JSON leaves and arrives this way.
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

/** Opens the share sheet with the text; resolves once it closes. */
export async function shareText(text: string, title: string): Promise<void> {
  await Share.share({ message: text, title });
}
