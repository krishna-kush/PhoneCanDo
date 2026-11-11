import { useEffect, useRef } from 'react';

// A step inside a page that Back undoes before the page goes: a form's
// review back to the form, an open filter sheet. The newest one registered
// runs first (useBackChain); while any is up, a back gesture previews
// nothing, since the page stays.
const handlers: (() => void)[] = [];
let onChange: (() => void) | null = null;

/** Told whenever an interceptor comes or goes (backTarget.ts mirrors it to the UI thread). */
export function onBackInterceptorsChange(listener: () => void) {
  onChange = listener;
}

export function useBackInterceptor(active: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!active) return;
    const handler = () => latest.current();
    handlers.push(handler);
    onChange?.();
    return () => {
      const i = handlers.lastIndexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
      onChange?.();
    };
  }, [active]);
}

export function hasBackInterceptor(): boolean {
  return handlers.length > 0;
}

/** Runs the newest interceptor; false when there is none. */
export function runBackInterceptor(): boolean {
  const handler = handlers[handlers.length - 1];
  if (!handler) return false;
  handler();
  return true;
}
