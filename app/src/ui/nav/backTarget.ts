import { useAppStore } from '../../state/app';
import { hasBackInterceptor, onBackInterceptorsChange } from './interceptors';
import { backTarget } from './progress';

// What a back gesture would preview right now, mirrored into a UI-thread
// value so the gesture's first frame needs no JS: nothing while a step
// inside a page takes Back (interceptors.ts) or a page is mid-transition,
// else the drawer when open, else the top page.
let transitionBusy = false;

export function syncBackTarget() {
  const app = useAppStore.getState();
  const next = hasBackInterceptor() || transitionBusy ? 0 : app.drawerOpen ? 2 : app.pages.length > 0 ? 1 : 0;
  if (backTarget.value !== next) backTarget.value = next;
}

/** PageStack: a push or a pop is animating (a gesture would fight it). */
export function setTransitionBusy(busy: boolean) {
  transitionBusy = busy;
  syncBackTarget();
}

onBackInterceptorsChange(syncBackTarget);

useAppStore.subscribe((s, prev) => {
  if (s.pages !== prev.pages || s.drawerOpen !== prev.drawerOpen) syncBackTarget();
});
