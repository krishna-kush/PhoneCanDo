// The narrator's lines, one a shot, and how the crew fixes each: the words
// they strike and what they write in their place. A line is wrong until it
// is fixed; the fixed sentence is the film's real claim. The dawn line is
// the one he gets right. When each thing happens is in moments.ts.

import { FACTS } from '../../../brand/facts/facts.ts';
import type { ShotId } from '../beats.ts';

export type NarratorLine = {
  /** The sentence, with the words to strike between [ and ]. */
  says: string;
  /** What is written in after the struck words. */
  fix?: string;
  /** The narrator is right: nobody fixes it, and it gets a tick. */
  right?: boolean;
};

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** A small count in words, as a narrator would say it. */
const inWords = (n: number) => NUMBERS[n] ?? String(n);

/** Everyone but A-01: the agent kinds there are, less one. */
const others = FACTS.agents.length - 1;

export const LINES: Record<ShotId, NarratorLine> = {
  lights: { says: 'Night. A phone, left alone, does [nothing].', fix: 'plenty' },
  crew: { says: 'The A-01 lives [alone].', fix: `with ${inWords(others)} others` },
  tools: { says: 'They have [no tools].', fix: 'a whole Linux' },
  gate: { says: 'They go wherever [they] please.', fix: 'you' },
  chores: { says: 'They [cannot] use the apps. No thumbs.', fix: 'can' },
  song: { says: 'They make [no] sound.', fix: 'a lot of' },
  dawn: { says: 'By morning there is no trace of them.', right: true },
  end: { says: 'We give up. See for yourself.' },
};

/** A line's parts: what comes before the struck words, the struck words, and what follows. */
export function partsOf(line: NarratorLine): { before: string; struck: string; after: string } {
  const m = /^(.*)\[(.*)\](.*)$/.exec(line.says);
  return m ? { before: m[1], struck: m[2], after: m[3] } : { before: line.says, struck: '', after: '' };
}
