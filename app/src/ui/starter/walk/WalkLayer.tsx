import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { useAppStore } from '../../../state/app';
import { useKeyboardStore } from '../../../state/keyboard';
import { useStarterStore } from '../../../state/starter';
import { HIT } from '../../common/globals';
import { useReduceMotion } from '../../common/useReduceMotion';
import { missionCopy, type StarterContext } from '../copy';
import { awayLine, heatCaption, LOST_CAPTION, LOST_LINE, outOfSight, stepLine, switchedHint, walkKicker } from './copy';
import DonePill from './DonePill';
import { arrowX, bubbleSpot, frameOf, sightOf, tuckedAt, type Rect, type Room } from './logic/frame';
import Spotlight from './pointer/Spotlight';
import { useFrameMotion } from './pointer/useFrameMotion';
import TuckedGuide from './TuckedGuide';
import { useSpotRect } from './useSpotRect';
import type { WalkView } from './useWalkView';
import WalkBubble, { ARROW_INSET, SIDE } from './WalkBubble';

export type ShownWalk = Exclude<WalkView, { kind: 'none' }>;

/** The bubble's height before it is laid out, its gap from the frame, and the room kept from the screen's bars. */
const GUESS_H = 128;
const GAP = 16;
const MARGIN = 8;
/** How long a step's spot may be missing (a page still opening) before the bubble gives up on it. */
const WAIT_MS = 600;

// The guide over the whole app on a walk: the pointer on the spot to tap
// (pointer/), the bubble saying what to tap, beside it and never on it, or,
// on a wrong turn, a spot scrolled away or one that doesn't come, at the
// screen's foot. Between steps it stays put until the next spot is there.
// A tap on the face tucks the bubble away until the next step. At the
// end, the stamp. It takes no taps but its own buttons: the app under it
// works.
export default function WalkLayer({ view, ctx }: { view: ShownWalk; ctx: StarterContext }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [box, setBox] = useState<Rect | null>(null);
  const [bubbleH, setBubbleH] = useState(GUESS_H);
  // The step the bubble was tucked away on: a new step brings it back.
  const [tuckedOn, setTuckedOn] = useState<string | null>(null);
  const reduce = useReduceMotion();
  const keyboardOpen = useKeyboardStore((s) => s.open);
  const endWalk = useStarterStore((s) => s.endWalk);
  const step = view.kind === 'step' ? view.step : null;
  const spot = useSpotRect(view.kind === 'step' && view.ready ? view.step.spot : null);
  const waiting = useHeld(view.kind === 'step' && view.step.spot != null && !view.ready, WAIT_MS);

  const insets = initialWindowMetrics?.insets;
  const room: Room | null = box
    ? { width: box.width, top: (insets?.top ?? 0) + MARGIN, bottom: box.height - (insets?.bottom ?? 0) - MARGIN }
    : null;
  const frame =
    box && step && spot.rect
      ? frameOf({ ...spot.rect, x: spot.rect.x - box.x, y: spot.rect.y - box.y }, spot.reach, step.foot === true)
      : null;
  const sight = frame && room ? sightOf(frame, room) : null;
  const onScreen = sight === 'on' ? frame : null;
  // The pointer lands once its spot has stopped moving and then stays on
  // it, following any shift; the bubble moves only to a spot at rest.
  const shown = onScreen != null && spot.settled;
  const resting = shown && spot.still;
  // On to the next step, it stays where it was until the next spot settles,
  // then glides there, rather than going out and opening wide again; it
  // goes out on a wrong turn, a spot scrolled away or one that doesn't come.
  const last = useRef<{ frame: Rect; target: string | null } | null>(null);
  if (shown) last.current = { frame: onScreen, target: step?.spot ?? null };
  else if (view.kind !== 'step' || step?.spot == null || waiting || sight === 'above' || sight === 'below') last.current = null;
  const pointer = shown ? { frame: onScreen, target: step?.spot ?? null } : last.current;
  const motion = useFrameMotion(pointer?.frame ?? null, pointer != null, reduce, pointer?.target ?? null);
  const boxW = box?.width ?? 0;
  const boxH = box?.height ?? 0;
  const size = useMemo(() => ({ width: boxW, height: boxH }), [boxW, boxH]);

  const stepKey = step ? `${step.hop}:${step.spot}` : view.kind;
  const tucked = tuckedOn === stepKey;

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => setBox({ x, y, width, height }));
  }, []);

  const nextJob = () => {
    endWalk();
    const app = useAppStore.getState();
    app.goHome();
    app.push({ name: 'starter' });
  };

  const title = missionCopy(view.mission, ctx).title;
  let guide = null;
  if (room) {
    const width = room.width - 2 * SIDE;
    const footTop = room.bottom - bubbleH;
    const mood = view.kind === 'lost' ? 'oops' : 'happy';
    if (view.kind === 'done') {
      guide = <DonePill mission={view.mission} title={title} top={room.top} width={width} onNext={nextJob} onClose={endWalk} />;
    } else if (tucked) {
      const at = tuckedAt(onScreen, room, HIT.minTouch, SIDE);
      guide = <TuckedGuide left={at.left} top={at.top} mood={mood} onUntuck={() => setTuckedOn(null)} />;
    } else {
      // Beside the spot once it has stopped moving; at the foot with no spot
      // to sit by (none, one that doesn't come, scrolled away); while its
      // spot slides in or the next one is on its way, where it was.
      let top: number | null = null;
      let arrow: { edge: 'top' | 'bottom'; x: number } | null = null;
      if (resting && onScreen) {
        const at = bubbleSpot(onScreen, room, bubbleH, GAP);
        top = at.top;
        if (at.side) arrow = { edge: at.side === 'below' ? 'top' : 'bottom', x: arrowX(onScreen, SIDE, width, ARROW_INSET) };
      } else if (view.kind !== 'step' || view.step.spot == null || waiting || sight === 'above' || sight === 'below') {
        // The keyboard up (only ever on a wrong turn): at the top, where it can't cover it.
        top = keyboardOpen ? room.top : footTop;
      }
      guide = (
        <WalkBubble
          top={top}
          startTop={footTop}
          width={width}
          arrow={arrow}
          kicker={step && view.kind === 'step' ? walkKicker(title, step.hop, view.hops) : title}
          caption={step && view.kind === 'step' ? heatCaption(step.hop, view.hops) : LOST_CAPTION}
          line={step ? stepLine(step.id, ctx) : view.kind === 'lost' && view.away ? awayLine(view.away) : LOST_LINE}
          hint={
            sight === 'above' || sight === 'below'
              ? outOfSight(sight)
              : view.kind === 'step' && view.step.hop === 1 && view.switchedTo
                ? switchedHint(view.switchedTo)
                : null
          }
          mood={mood}
          reduce={reduce}
          onHeight={setBubbleH}
          onStop={endWalk}
          onTuck={() => setTuckedOn(stepKey)}
        />
      );
    }
  }

  return (
    <View ref={ref} collapsable={false} pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={measure}>
      {room && box && step ? (
        <Spotlight
          motion={motion}
          frame={pointer?.frame ?? null}
          shown={pointer != null}
          room={room}
          size={size}
          hop={step.hop}
          reduce={reduce}
        />
      ) : null}
      {guide}
    </View>
  );
}

/** True once [on] has held for [ms]; false again as soon as it stops. */
function useHeld(on: boolean, ms: number): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    setHeld(false);
    if (!on) return;
    const timer = setTimeout(() => setHeld(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return held && on;
}
