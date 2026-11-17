import { useEffect, useState } from 'react';
import { type Part, PARTS, unionOf } from '../change/parts';
import { endShift, endsAfterMs, firstShift, SETTLE_MS, type Shift, shiftTo } from '../change/shift';
import type { Reaction } from '../change/specs';
import type { Mood } from '../mood';

type Asked = { mood: Mood; reaction?: Reaction; hop: number };

/**
 * A live face's change of mood, as React keeps it (change/shift.ts): each
 * new [mood] starts a change from what the face shows (a [reaction] newly
 * given plays instead; a [hop] with it means a tap), taken at once while
 * [quiet] or in the face's first moment; once played out it rests. `parts`
 * is every part it has drawn: a part stays drawn once it has been (unseen
 * while its mood is not on), so it never mounts again mid-change.
 */
export function useMoodChange(mood: Mood, reaction: Reaction | undefined, hop: number, quiet: boolean): { shift: Shift; parts: readonly Part[] } {
  const [born] = useState(() => Date.now());
  const [shift, setShift] = useState(() => firstShift(mood, quiet ? undefined : reaction, born));
  const [asked, setAsked] = useState<Asked>({ mood, reaction, hop });

  if (mood !== asked.mood || reaction !== asked.reaction || hop !== asked.hop) {
    setAsked({ mood, reaction, hop });
    const played = reaction != null && reaction !== asked.reaction;
    if (mood !== asked.mood || played) {
      const now = Date.now();
      setShift(shiftTo(shift, { to: mood, reaction: played ? reaction : undefined, booped: hop !== asked.hop, now, snap: quiet || now - born < SETTLE_MS }));
    }
  } else if (quiet && shift.change) {
    setShift(shiftTo(shift, { to: shift.to, booped: false, now: Date.now(), snap: true }));
  }

  useEffect(() => {
    if (!shift.change) return;
    const id = setTimeout(() => setShift((s) => (s.id === shift.id ? endShift(s) : s)), endsAfterMs(shift) - (Date.now() - shift.startedAt));
    return () => clearTimeout(id);
  }, [shift]);

  const shown = unionOf(PARTS[shift.from], PARTS[shift.to]);
  const [parts, setParts] = useState(shown);
  if (shown.some((p) => !parts.includes(p))) setParts(unionOf(parts, shown));

  return { shift, parts };
}
