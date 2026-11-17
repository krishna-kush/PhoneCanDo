// VS mode on the Choose agent step: two applicants stat by stat, as a
// fighting game's VS screen. For each stat both sides' words and meter (or
// coin) and who takes it; the score over the stats that count, and the
// verdict. Pure (zero RN imports).
import { coinOf, COIN_VALUE, type Coin } from './coin.ts';
import { borrowedStars, fansMeter, fansOf, fansRepo, starsText } from './fans.ts';
import { type FactKind, MESSAGES, NO_REPO, SCHEDULES, scheduleLevel } from './facts.ts';
import { powerMove } from './howToPlay.ts';

export type VsCell = { value: string; meter: number | null; coin?: Coin };

/** left: the pick takes it; right: the challenger; tie: even; null: a plain fact nobody takes. */
export type VsWinner = 'left' | 'right' | 'tie' | null;

export type VsRow = { term: string; left: VsCell; right: VsCell; winner: VsWinner };

export type VsVerdict = 'pick' | 'challenger' | 'draw';

/** How free each coin plays, best first, as coinOf ranks them. */
const COIN_RANK: Record<Coin, number> = { play: 3, tier: 2, local: 1, slot: 0 };

/**
 * The stats both sides show, in the showcase's order; fans only when both
 * were counted (stars on another name's repo said as that repo's, and
 * nobody takes the row then), power moves when both have one.
 */
export function vsRows(left: FactKind, right: FactKind): VsRow[] {
  const rows: VsRow[] = [];
  const coins = [coinOf(left), coinOf(right)] as const;
  rows.push({
    term: 'Cost',
    left: { value: COIN_VALUE[coins[0]], meter: null, coin: coins[0] },
    right: { value: COIN_VALUE[coins[1]], meter: null, coin: coins[1] },
    winner: takes(COIN_RANK[coins[0]], COIN_RANK[coins[1]]),
  });
  const stars = [fansOf(left.id), fansOf(right.id)] as const;
  if (stars[0] !== undefined && stars[1] !== undefined) {
    const repos = [fansRepo(left), fansRepo(right)] as const;
    rows.push({
      term: 'Fans',
      left: fansCell(stars[0], repos[0]),
      right: fansCell(stars[1], repos[1]),
      winner: repos[0] || repos[1] ? null : takes(stars[0] ?? -1, stars[1] ?? -1),
    });
  }
  const said = [MESSAGES[left.messaging], MESSAGES[right.messaging]] as const;
  rows.push({ term: 'Messages', left: said[0], right: said[1], winner: takes(said[0].meter, said[1].meter) });
  const tasks = [SCHEDULES[scheduleLevel(left)], SCHEDULES[scheduleLevel(right)]] as const;
  rows.push({ term: 'Schedules', left: tasks[0], right: tasks[1], winner: takes(tasks[0].meter, tasks[1].meter) });
  rows.push({ term: 'Home', left: homeCell(left), right: homeCell(right), winner: null });
  const moves = [powerMove(left.about), powerMove(right.about)] as const;
  if (moves[0] && moves[1]) {
    rows.push({ term: 'Move', left: { value: moves[0].keys, meter: null }, right: { value: moves[1].keys, meter: null }, winner: null });
  }
  return rows;
}

/** The stats each side took. */
export function vsScore(rows: readonly VsRow[]): { left: number; right: number } {
  return {
    left: rows.filter((r) => r.winner === 'left').length,
    right: rows.filter((r) => r.winner === 'right').length,
  };
}

export function vsVerdict(score: { left: number; right: number }): VsVerdict {
  return score.left > score.right ? 'pick' : score.right > score.left ? 'challenger' : 'draw';
}

/** What a screen reader hears for a row: each side's words, then who takes it. */
export function vsRowLabel(row: VsRow, leftName: string, rightName: string): string {
  const who =
    row.winner === 'left' ? `${leftName} takes it` : row.winner === 'right' ? `${rightName} takes it` : row.winner === 'tie' ? 'even' : '';
  return [`${row.term}: ${leftName} ${row.left.value}, ${rightName} ${row.right.value}`, who].filter(Boolean).join('; ');
}

const takes = (a: number, b: number): VsWinner => (a > b ? 'left' : b > a ? 'right' : 'tie');

const fansCell = (stars: number | null, repo: string | null): VsCell =>
  stars == null
    ? { value: NO_REPO, meter: 0 }
    : { value: repo ? borrowedStars(repo, stars) : starsText(stars), meter: fansMeter(stars) };

const homeCell = (kind: FactKind): VsCell => ({ value: kind.home === 'web' ? 'web page' : 'terminal', meter: null });
