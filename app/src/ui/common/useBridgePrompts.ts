// One queue for every prompt dialog (unlock, accessibility setup, a link to
// open), so only one shows at a time: the oldest waiting prompt. Native is the source of
// truth (each agent request registers its own prompt and removes it when it
// returns), so we read it on mount, on resume, on every prompt event and once
// a second while anything is queued. That also drops prompts whose request
// ended without us: a timeout, the service connecting, another unlock.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as runner from '../../engine/runner';
import type { BridgePrompt } from '../../engine/runner';
import { forgetGone, samePrompts, visiblePrompts } from './promptQueue';

let queue: BridgePrompt[] = [];
let answered = new Set<string>();
const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function publish(next: BridgePrompt[]) {
  if (samePrompts(next, queue)) return;
  queue = next;
  poll(queue.length > 0);
  for (const listener of listeners) listener();
}

function refresh() {
  const pending = runner.pendingPrompts();
  answered = forgetGone(answered, pending);
  publish(visiblePrompts(pending, answered));
}

function poll(on: boolean) {
  if (on && !timer) timer = setInterval(refresh, 1000);
  if (!on && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function watch(): () => void {
  const sub = runner.onBridgePrompt(() => refresh());
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') refresh();
  });
  refresh();
  return () => {
    sub.remove();
    appState.remove();
    poll(false);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!stopWatching) stopWatching = watch();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopWatching) {
      stopWatching();
      stopWatching = null;
    }
  };
}

const snapshot = () => queue;

/** The user answered these prompts: take them off the queue now. */
export function markAnswered(requestIds: readonly string[]) {
  for (const id of requestIds) answered.add(id);
  publish(visiblePrompts(queue, answered));
}

/** Every waiting unlock prompt, freshly read (one unlock answers them all). */
export function pendingUnlockIds(): string[] {
  return runner
    .pendingPrompts()
    .filter((p) => p.kind === 'unlock')
    .map((p) => p.requestId);
}

export function useBridgePrompts(): { current: BridgePrompt | null; queue: BridgePrompt[] } {
  const q = useSyncExternalStore(subscribe, snapshot);
  return { current: q[0] ?? null, queue: q };
}
