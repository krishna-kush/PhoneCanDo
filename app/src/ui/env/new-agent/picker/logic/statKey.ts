// The stat key at the foot of the Choose agent step, as a game's manual
// explains its stat screen: every level of each stat the showcase shows
// (cost, fans, messages, schedules), each with its coin or meter, its words
// and what it means, what a power move is and how VS mode starts. Pure
// (zero RN imports).
import { LEVELS, levelMeaning } from '../../../../messages/logic/levels.ts';
import { COIN_VALUE, type Coin } from './coin.ts';
import { LOUDER, LOUDEST, starsText } from './fans.ts';
import { MESSAGES, NO_REPO, SCHEDULES, type ScheduleLevel } from './facts.ts';
import { METER_MAX } from './meter.ts';

export type KeyMark = { coin: Coin } | { meter: number } | { input: string };

export type KeyRow = { mark: KeyMark; value: string; meaning: string | null };

export type KeySection = { term: string; rows: KeyRow[]; note: string | null };

/** The key's title. */
export const STAT_KEY = 'Stat key';

const COINS: readonly { coin: Coin; meaning: string }[] = [
  { coin: 'play', meaning: 'Its makers host models you can use for free.' },
  { coin: 'tier', meaning: 'A free plan or key from its makers, with limits.' },
  { coin: 'local', meaning: 'Free on a model that runs on this phone.' },
  { coin: 'slot', meaning: 'Bring its paid plan or an API key.' },
];

const SCHEDULE_MEANINGS: Record<ScheduleLevel, string> = {
  wakes: "A task starts it if it's stopped and wakes it if it's idle. If it's busy, the task waits for its run to end.",
  starts: "A task starts it if it's stopped. It can't be woken, so while it runs the task waits, then restarts it with the task.",
  none: "It can't run scheduled tasks.",
};

/** What a power move looks like. */
const SAMPLE_MOVE = '/undo';

/** The key's sections, in the showcase's order. */
export function statKey(): KeySection[] {
  return [
    {
      term: 'Cost',
      rows: COINS.map(({ coin, meaning }) => ({ mark: { coin }, value: COIN_VALUE[coin], meaning })),
      note: null,
    },
    {
      term: 'Fans',
      rows: [
        { mark: { meter: METER_MAX }, value: `${starsText(LOUDEST)}+ stars`, meaning: 'A stadium crowd.' },
        { mark: { meter: 2 }, value: `${starsText(LOUDER)}+ stars`, meaning: 'An arena crowd.' },
        { mark: { meter: 1 }, value: `under ${starsText(LOUDER)} stars`, meaning: 'A club crowd, loyal and loud.' },
        { mark: { meter: 0 }, value: NO_REPO, meaning: 'Closed source: nothing to star.' },
      ],
      note:
        "Its GitHub stars, counted again with every app build. The Fans row says when the crowd was last counted. An agent named apart from the repo its code comes from shows that repo's stars by the repo's name, and they win no VS.",
    },
    {
      term: 'Messages',
      rows: LEVELS.map((level) => ({ mark: { meter: MESSAGES[level].meter }, value: MESSAGES[level].value, meaning: levelMeaning(level) })),
      note: 'How messages from your other agents reach it.',
    },
    {
      term: 'Schedules',
      rows: (['wakes', 'starts', 'none'] as const).map((level) => ({
        mark: { meter: SCHEDULES[level].meter },
        value: SCHEDULES[level].value,
        meaning: SCHEDULE_MEANINGS[level],
      })),
      note: 'How a task you set for a time reaches it.',
    },
    {
      term: 'Power move',
      rows: [
        {
          mark: { input: SAMPLE_MOVE },
          value: '',
          meaning: "What it's best known for, and how to do it: type the move in the agent's own app once it's running.",
        },
      ],
      note: null,
    },
    {
      term: 'VS',
      rows: [
        {
          mark: { input: 'VS' },
          value: '',
          meaning: 'Tap the VS sticker, or hold any agent, to put it up against your pick stat by stat. Next still makes your pick.',
        },
      ],
      note: null,
    },
  ];
}
