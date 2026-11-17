import { useEffect, useState } from 'react';
import { agentKind } from '../../../engine/agents/registry';
import { useActiveAgent, useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { useKeyboardStore } from '../../../state/keyboard';
import type { MissionId } from '../../../state/logic/starter/missions';
import { useStarterStore } from '../../../state/starter';
import type { SpotId } from '../../common/spot/ids';
import { hasSpot } from '../../common/spot/registry';
import { useSpotsVersion } from '../../common/spot/useSpot';
import { wantSpots } from '../../common/spot/wanted';
import { placeOf, stepsBack, walkAt, walkFor, type HomeView, type Step, type WalkAt } from './logic/walks';

export type WalkView =
  | { kind: 'none' }
  /** Seen done on the way: the stamp. */
  | { kind: 'done'; mission: MissionId }
  /** A wrong turn; `away`: another agent is up, not the one the walk is with (its name). */
  | { kind: 'lost'; mission: MissionId; away: string | null }
  /** A step; `ready` once its spot is on screen; `switchedTo`: the agent the walk switched Home to as it started. */
  | { kind: 'step'; mission: MissionId; step: Step; hops: number; ready: boolean; switchedTo: string | null };

const NONE: WalkView = { kind: 'none' };
/** How long a step back must last before the guide shows it. */
const BACK_MS = 600;

// What the guide shows now, from the walk (Say hi's goes by what Home
// shows: a terminal, or a web UI), where the app is and the spots on
// screen (logic/walks.ts); it asks for the walk's spots while it is on
// (common/spot/wanted.ts). A step back shows only once it has lasted
// (stepsBack), so a screen passing through one doesn't send the guide up
// and back down. A walk that goes with one agent (logic/walkAgent.ts) is a
// wrong turn while another is up. No step while the keyboard is open (it
// would sit on what you type), though a wrong turn still shows (another
// agent's terminal opens the keyboard by itself); nothing on the first
// shift's own page. Arriving
// at the walk's page stamps it; typing in the chat on Say hi sends the
// guide away until the stamp, as the rest is the agent's answer.
export function useWalkView(): WalkView {
  const walk = useStarterStore((s) => s.walk);
  const place = useAppStore((s) => placeOf(s.pages, s.drawerOpen));
  const keyboardOpen = useKeyboardStore((s) => s.open);
  const agent = useActiveAgent();
  const walkAgentName = useAgentsStore((s) => (walk?.agentId ? (s.agents.find((a) => a.id === walk.agentId)?.name ?? null) : null));
  const away = walkAgentName != null && agent?.id !== walk?.agentId ? walkAgentName : null;
  const home: HomeView = agent && agentKind(agent.kind).home === 'web' ? 'web' : 'tui';
  useSpotsVersion();
  const plan = walk ? walkFor(walk.mission, home) : null;
  const now = plan && !walk?.done ? walkAt(plan, place, hasSpot) : null;
  const at = useLasting(now);
  const arrived = now?.kind === 'goal';
  // Typing in the right agent's chat; another agent's terminal pops the keyboard up by itself.
  const typingInChat = !away && keyboardOpen && now?.kind === 'step' && now.step.id === 'chat';
  const looking = plan && walk && !walk.done && !walk.quiet ? plan.steps.flatMap((s) => (s.spot ? [s.spot] : [])) : [];
  const lookingKey = looking.join(' ');

  useEffect(() => {
    wantSpots(lookingKey ? (lookingKey.split(' ') as SpotId[]) : []);
  }, [lookingKey]);
  useEffect(() => () => wantSpots([]), []);
  useEffect(() => {
    if (arrived) useStarterStore.getState().walkDone();
  }, [arrived]);
  useEffect(() => {
    if (typingInChat) useStarterStore.getState().quietWalk();
  }, [typingInChat]);

  if (!walk) return NONE;
  if (walk.done) return { kind: 'done', mission: walk.mission };
  if (walk.quiet || !at || at.kind === 'goal' || at.kind === 'aside') return NONE;
  // A wrong turn stays up with the keyboard open (WalkLayer sets it at the top); a step keeps out of the way.
  if (away) return { kind: 'lost', mission: walk.mission, away };
  if (at.kind === 'lost') return { kind: 'lost', mission: walk.mission, away: null };
  if (keyboardOpen) return NONE;
  const switchedTo = walk.switched ? walkAgentName : null;
  return { kind: 'step', mission: walk.mission, step: at.step, hops: at.hops, ready: at.ready, switchedTo };
}

/** [now], but a step back from what shows only once it has lasted BACK_MS; anything else at once. */
function useLasting(now: WalkAt | null): WalkAt | null {
  const [shown, setShown] = useState(now);
  const back = stepsBack(shown, now);
  const key = now?.kind === 'step' ? `${now.step.hop}:${now.step.spot}:${now.ready}` : (now?.kind ?? 'none');
  useEffect(() => {
    if (!back) {
      setShown(now);
      return;
    }
    const timer = setTimeout(() => setShown(now), BACK_MS);
    return () => clearTimeout(timer);
    // Keyed by where it is, not by the object, which is new each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, back]);
  return back ? shown : now;
}
