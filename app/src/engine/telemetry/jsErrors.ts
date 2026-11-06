// JS errors: a global handler (installed once, at boot) that records each
// non-fatal error as a 'js' error, then hands it to the handler it replaced.
// Fatal ones become native crashes, which Kotlin records.
import { getClient } from './client';

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler?: () => GlobalHandler; setGlobalHandler?: (h: GlobalHandler) => void };

function recordJsError(error: unknown): void {
  const c = getClient();
  if (!c) return;
  const e = error instanceof Error ? error : null;
  const className = e?.name || 'Error';
  const message = e ? e.message : String(error);
  const lines = (e?.stack ?? '').split('\n').map((l) => l.trim());
  // Hermes frames start with "at "; the first stack line repeats the message.
  const at = lines.filter((l) => l.startsWith('at '));
  const frames = at.length > 0 ? at : lines.slice(1).filter(Boolean);
  c.error({ kind: 'js', className, message, frames });
}

let handlerInstalled = false;
export function installErrorHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  try {
    const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
    if (!eu || typeof eu.setGlobalHandler !== 'function') return;
    const previous = typeof eu.getGlobalHandler === 'function' ? eu.getGlobalHandler() : undefined;
    eu.setGlobalHandler((error, isFatal) => {
      try {
        // A fatal error is rethrown by React Native as a native
        // JavascriptException, which the Kotlin crash handler records; a JS
        // record too would count it twice.
        if (!isFatal) recordJsError(error);
      } catch {
        // never let telemetry hide the real error
      }
      previous?.(error, isFatal);
    });
  } catch {
    // no ErrorUtils (tests, web)
  }
}
