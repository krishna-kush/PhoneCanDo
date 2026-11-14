import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SECTIONS, type Section } from '../../timeline/music.ts';
import { sectionsOf } from '../../timeline/cues.ts';
import { TOTAL } from '../../timeline/scenes.ts';
import { sampleOf } from '../rate.ts';
import { arrange } from './arrange.ts';
import { HOOK } from './hook.ts';
import { planOf, STOP } from './plan.ts';
import { TRACKS } from './tracks.ts';

const energy = (n: number, plan: ReturnType<typeof planOf>) => {
  const { tracks } = arrange(plan, n);
  let e = 0;
  for (const t of TRACKS) for (let i = 0; i < n; i++) e += tracks[t].l[i] ** 2 + tracks[t].r[i] ** 2;
  return e;
};

for (const kind of Object.keys(SECTIONS) as Section[]) {
  test(`${kind} plays on its own`, () => {
    const plan = planOf([{ at: 0, section: kind }], 8);
    const e = energy(sampleOf(8), plan);
    if (kind === 'gap' || kind === 'stop') assert.equal(e, 0, 'silence is silent');
    else assert.ok(e > 0, 'it makes a sound');
  });
}

test('a gap and a stop silence the music up to the next section', () => {
  const plan = planOf(
    [
      { at: 0, section: 'drop' },
      { at: 6, section: 'stop' },
      { at: 8, section: 'drop' },
      { at: 11.5, section: 'gap' },
      { at: 12, section: 'finale' },
    ],
    16,
  );
  assert.deepEqual(plan.silences, [
    { from: 6 + STOP, to: 8 },
    { from: 11.5, to: 12 },
  ]);
  assert.deepEqual(plan.stops, [6]);
  // The drop before the stop plays on into it, for the tape to wind down on.
  assert.equal(plan.spans[0].to, 6 + STOP);
  assert.equal(plan.spans[0].limit, 6 + STOP);
  assert.equal(plan.spans[1].limit, 11.5);
});

test('every drop and the finale start on Am, the hook on its first bar', () => {
  const plan = planOf(sectionsOf(), TOTAL);
  for (const s of plan.spans.filter((x) => x.kind === 'drop' || x.kind === 'finale')) {
    assert.equal(s.prog[0].name, 'Am');
    assert.equal(s.anchor, Math.floor(s.from / 4));
  }
});

test('the hook fills its bars without overlaps', () => {
  for (const bar of HOOK) {
    for (let i = 0; i < bar.length; i++) {
      const [step, , len] = bar[i];
      const next = bar[i + 1]?.[0] ?? 16;
      assert.ok(step + len <= next, `note at ${step} runs into the next`);
    }
  }
});
