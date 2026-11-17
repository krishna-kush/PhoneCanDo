import type { Look } from '../../../../../mascot/look.ts';
import type { SetupState } from '../logic/stage';

/** What the setup screen's arcade scene is handed (SetupBody.tsx). */
export type SceneProps = {
  state: SetupState;
  /** The agent's mascot, the one it keeps. */
  mascot: Look;
  /** The agent's kind, as its name reads ("opencode"). */
  agentName: string;
  /** The status line under the scene ("Unpacking · 42%"). */
  label: string;
};
