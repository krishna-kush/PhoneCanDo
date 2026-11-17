// The Choose agent step's words (the arcade). Pure (zero RN imports).
import type { VsVerdict } from './logic/vs.ts';

/** The showcase's strip. */
export const ARCADE = { head: 'Player 1 · select' } as const;

/** The line over who sits out here. */
export const SITTING_OUT = "Can't work here";

/** The showcase's foot: its power move, and its official pages. */
export const POWER_MOVE = 'Power move';
export const POWER_MOVE_HINT = 'Type it in its own app.';
export const HOW_TO_PLAY = 'How to play';

/** Under the applicant's name: who makes it. */
export const makerLine = (maker: string) => `by ${maker}`;

/** The stamp on the kind a fresh install starts with (its manifest's `default`), and what it means. */
export const HOUSE_PICK = 'House pick';
export const HOUSE_PICK_LINE = 'already lives here';

/** When no app opens a link. */
export const openElsewhere = (url: string) => `Open ${url} in a browser.`;

/** VS mode: another agent challenges the pick, stat by stat. */
export const VS_STICKER = 'challenge';
export const VS_STICKER_LABEL = 'VS: put another agent up against this one';
export const NEW_CHALLENGER = 'Here comes a new challenger!';
export const LEAVE_VS = 'Leave VS';
export const vsHead = (pick: string, challenger: string) => `${pick} vs ${challenger}`;
export const pickInstead = (label: string) => `Pick ${label}`;
export const vsScoreNote = (pick: string) =>
  `Cost, fans, messages and schedules count. Tap an agent below to change the challenger; Next makes ${pick}.`;

/** Who won the match up, by name. */
export function verdictText(verdict: VsVerdict, pick: string, challenger: string): string {
  return verdict === 'pick' ? `${pick} wins` : verdict === 'challenger' ? `${challenger} wins` : 'Draw';
}
