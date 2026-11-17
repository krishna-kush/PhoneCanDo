// The agent's face on the work order, for a moment: looking about while
// you write its task (reading along), pleased with hearts and a hop as the
// order is filed or sent now, asleep once it is torn up; its engine
// state's mood otherwise. Pure (zero RN imports).
import type { Mood } from '../../common/face/mood';
import type { StampWord } from './editorCopy.ts';

export type FaceCue = { mood?: Mood; hearts?: number };

export function faceCue(stamp: StampWord | null, reading: boolean): FaceCue {
  switch (stamp) {
    case 'added':
    case 'saved':
      return { mood: 'happy', hearts: 2 };
    case 'sent':
      return { mood: 'happy', hearts: 1 };
    case 'deleted':
      return { mood: 'asleep' };
    case null:
      return reading ? { mood: 'busy' } : {};
  }
}
