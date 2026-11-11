import { makeMutable } from 'react-native-reanimated';

// The page transition's state, live on the UI thread (motion.ts reads it;
// stackMotion.ts and backWorklet.ts write it). Which part each layer plays
// is here too, by layer key, not in React props, so a transition needs no
// render of a layer's animated view (PageLayer.tsx says why that matters).
export const pushProgress = makeMutable(1);
export const pullProgress = makeMutable(0);
export const commitProgress = makeMutable(0);
export const pullEdge = makeMutable(1);
/** The drawer pulled in by a back gesture, 0 → 1. */
export const drawerPull = makeMutable(0);

/** 0 at rest, 1 a page entering (push), 2 a page leaving (pop). */
export const motionKind = makeMutable(0);
/** The newest motion's id (transitionStore.ts): an older one that has yet to start never does. */
export const motionId = makeMutable(0);
/** The layer that enters (push) or leaves (pop). */
export const movingKey = makeMutable('');
/** The layer under it: the one that exits (push) or is revealed (pop). */
export const underKey = makeMutable('');
/** At rest: the top layer and the one right under it. */
export const topKey = makeMutable('home');
export const belowKey = makeMutable('');
/** A back gesture is previewing the top page (it shrinks, the one below shows). */
export const previewing = makeMutable(false);

/** What a back gesture previews now (kept current by backTarget.ts): 0 nothing, 1 the top page, 2 the drawer. */
export const backTarget = makeMutable(0);
/** The target of the gesture under way (0 none). */
export const gestureTarget = makeMutable(0);
