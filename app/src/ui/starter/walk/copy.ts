// What the guide says on a walk (logic/walks.ts): each step's line, its
// caption beside it (warm, warmer, hot: how close you are; brr on a wrong
// turn), a spot scrolled out of sight, and the stamp at the end. The guide
// is A-09 (guide.ts), not your agent, so it speaks of "your agent", and of
// itself only as the one pointing the way. Pure (zero RN imports).
import type { MissionId } from '../../../state/logic/starter/missions.ts';
import type { StarterContext } from '../copy.ts';
import type { StepId } from './logic/walks.ts';

export function stepLine(id: StepId, c: StarterContext): string {
  switch (id) {
    case 'chat':
      return c.models
        ? "Here's your agent's chat box. Your dare is copied: paste it here and send it. If it asks for a model first, pick one there."
        : "Here's your agent's chat box. Your dare is copied: paste it here and send it.";
    case 'projects':
      return 'No chat open yet. Chats live in projects: open the project list up top.';
    case 'addProject':
      return 'Add project. A project is just a folder your agent works in.';
    case 'pickFolder':
      return 'Any folder will do; the one it opened on is fine. Pick it here.';
    case 'newChat':
      return 'A project! Now start a new chat in it.';
    case 'name':
      return "Tap your agent's name. It opens the drawer, where every place in the app lives.";
    case 'menu':
      return "Tap ⋮ up here: your agent's own menu.";
    case 'menuAgent':
      return "Agent settings: your agent's own page.";
    case 'terminal':
      return c.linux
        ? 'Open terminal in the machine. Your command is typed in already.'
        : 'Open terminal. Your command is typed in already.';
    case 'settings':
      return 'Settings, down here.';
    case 'phone':
      return 'Phone control! Follow its steps to give your agent hands. Android double-checks, so it takes a few taps.';
    case 'updates':
      return 'Updates: the full build lives in there.';
    case 'newAgent':
      return 'New agent. Tap it!';
    case 'pick':
      return 'Pick one above (each brings its own brain and face), then tap Next.';
    case 'place':
      return c.linux
        ? 'Where does it live? Its own machine is best. Some ask you to sign in the first time.'
        : 'Pick where it lives, and it gets ready.';
    case 'machine':
      return 'Pick a Linux and it downloads. Your teammate moves in once it is there.';
    case 'schedules':
      return 'Schedules. Tap it.';
    case 'add':
      return 'Tap Add to give your agent a job.';
    case 'save':
      return 'Pick your agent, write the job, set the time, then save it.';
  }
}

/** A-01's caption on hop [hop] of [hops]: the closer, the hotter. */
export function heatCaption(hop: number, hops: number): string {
  const left = hops - hop;
  if (left <= 0) return 'hot!';
  if (left === 1) return 'warmer';
  return 'warm';
}

export function walkKicker(title: string, hop: number, hops: number): string {
  return `${title} · ${hop}/${hops}`;
}

export const LOST_CAPTION = 'brr · cold';
export const LOST_LINE = "Wrong door! Press Back and I'll point the way again.";

/** Another agent came up on a walk that goes with [name] (logic/walkAgent.ts). */
export const awayLine = (name: string): string => `Wrong agent! This walk is with ${name}: tap the name up top, then pick ${name}.`;

/** The walk switched Home to [name] as it started, on its first hop. */
export const switchedHint = (name: string): string => `↪ Over to ${name}: I know its screens by heart.`;

/** The spot is on its page, scrolled out of sight. */
export function outOfSight(where: 'above' | 'below'): string {
  return where === 'below' ? "↓ It's further down: scroll a bit." : "↑ It's further up: scroll back a bit.";
}

export const DONE_CAPTION = 'found it!';

export function doneLine(id: MissionId): string {
  switch (id) {
    case 'hello':
      return "That's your agent answering. Stamped!";
    case 'terminal':
      return 'Stamped! Press Enter to run it.';
    case 'hands':
      return 'Stamped! Your agent has hands now.';
    case 'upgrade':
      return 'Stamped! The full build is in here.';
    case 'teammate':
      return 'Stamped! Say hi to your new teammate.';
    case 'schedule':
      return 'Stamped! Your agent will be there on time.';
  }
}

export const NEXT_JOB = 'Next job';
export const STOP = 'Stop';
export const CLOSE = 'Close';
export const TUCK_LABEL = 'Tuck the guide away';
export const UNTUCK_LABEL = 'Show the guide again';
