// What an applicant costs to play, as an arcade says it: free play (its
// makers host models that cost nothing), a free tier (a free plan or key,
// with limits), free on a local model (one that runs on this phone), or
// insert coin (its plan or a key). Read from the kind's `about` and its
// `models` block. Pure (zero RN imports).
import type { KindView } from '../../../../../../../agents/kit/ts/contract/view.ts';

export type Coin = 'play' | 'tier' | 'local' | 'slot';

export type CoinKind = Pick<KindView, 'about' | 'models'>;

/** Each coin in a few words, as a screen reader hears it. */
export const COIN_WORDS: Record<Coin, string> = {
  play: 'Free play',
  tier: 'Free tier',
  local: 'Free on a local model',
  slot: 'Insert coin',
};

/** The cost stat's words, short enough for its one line. */
export const COIN_VALUE: Record<Coin, string> = {
  play: 'free play',
  tier: 'free tier',
  local: 'free, local',
  slot: 'insert coin',
};

/** The best free way to play it: its makers' free models, then their free tier, then a local model. */
export function coinOf(kind: CoinKind): Coin {
  const via = kind.about?.free?.via;
  if (via === 'models') return 'play';
  if (via === 'tier') return 'tier';
  return kind.models.length > 0 ? 'local' : 'slot';
}

/** The cost stat: its coin, its words and the line under them (how far free goes, or what to bring). */
export function costOf(kind: CoinKind): { coin: Coin; value: string; note: string } {
  const coin = coinOf(kind);
  const local = kind.models.length > 0;
  const free = kind.about?.free?.note;
  const lines =
    coin === 'local'
      ? ['On a model that runs on this phone.']
      : coin === 'slot'
        ? ['Bring its plan or an API key.']
        : [free ? endStop(free) : '', local ? 'Or free on a model on this phone.' : ''];
  return { coin, value: COIN_VALUE[coin], note: lines.filter(Boolean).join(' ') };
}

const endStop = (line: string) => (/[.!?]$/.test(line) ? line : `${line}.`);
