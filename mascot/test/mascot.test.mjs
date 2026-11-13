// The mascot spec over the real theme/logo.json: the catalog holds
// together, every look lays out in every facing, the layout keeps the
// backdrop's own numbers, and picks spread looks out. Node strips the
// modules' types. Run: pnpm -C mascot test (or node --test mascot/test)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { SHAPES, bodyOf, stretchOf } from '../body.ts';
import { DESIGNS, designOf } from '../designs.ts';
import { figure } from '../layout/figure.ts';
import { pathOf } from '../layout/path.ts';
import { PLAIN, lookKey, readLook } from '../look.ts';
import { FACES } from '../parts/face/index.ts';
import { HATS } from '../parts/hat/index.ts';
import { NECKS } from '../parts/neck/index.ts';
import { allLooks, assignLooks, pickLook } from '../pick.ts';

const logo = createRequire(import.meta.url)('../../theme/logo.json');
const body = bodyOf(logo);

/** A seeded 0-to-1 stream (mulberry32), so picks repeat. */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the body comes from the logo spec', () => {
  assert.equal(body.shadow, logo.shadow.ratio);
  assert.equal(body.long, 1.8);
  assert.deepEqual(stretchOf('wide', body), { w: 1.3, h: 1 });
  assert.deepEqual(stretchOf('taller', body), { w: 1, h: 1.8 });
});

test('designs have unique ids and names, and wear parts that exist in their slot', () => {
  assert.equal(new Set(DESIGNS.map((d) => d.id)).size, DESIGNS.length);
  assert.equal(new Set(DESIGNS.map((d) => d.name)).size, DESIGNS.length);
  for (const d of DESIGNS) {
    if (d.hat) assert.equal(HATS[d.hat].slot, 'hat', d.id);
    if (d.neck) assert.equal(NECKS[d.neck].slot, 'neck', d.id);
    if (d.face) assert.equal(FACES[d.face].slot, 'face', d.id);
  }
  assert.equal(designOf('plain')?.name, 'Plain');
  assert.equal(designOf('gone'), null);
});

test('every part is worn by some design', () => {
  const worn = new Set(DESIGNS.flatMap((d) => [d.hat, d.neck, d.face]).filter(Boolean));
  for (const id of [...Object.keys(HATS), ...Object.keys(NECKS), ...Object.keys(FACES)]) assert.ok(worn.has(id), id);
});

test('every look lays out in every facing, in finite numbers inside its bounds', () => {
  for (const look of allLooks()) {
    for (const facing of ['front', 'side', 'back']) {
      for (const toward of [-1, 1]) {
        const f = figure(look, { size: 24, body, facing, toward, gaze: [toward, 0] });
        const b = f.bounds;
        for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isFinite(v), `${lookKey(look)} ${facing}`);
        for (const box of [f.front, f.back]) {
          assert.ok(box.x >= b.x - 1e-9 && box.x + box.w <= b.x + b.w + 1e-9, `${lookKey(look)} ${facing} x`);
          assert.ok(box.y >= b.y - 1e-9 && box.y + box.h <= b.y + b.h + 1e-9, `${lookKey(look)} ${facing} y`);
        }
        for (const m of f.marks) assert.doesNotMatch(pathOf(m), /NaN|Infinity/, `${lookKey(look)} ${facing}`);
        assert.equal(f.eyes.length, facing === 'back' ? 0 : facing === 'side' ? 1 : 2);
      }
    }
  }
});

test('the plain square stands on its feet with the backdrop’s proportions', () => {
  const f = figure(PLAIN, { size: 30, body });
  const o = 30 * body.shadow;
  assert.deepEqual({ x: f.front.x, y: f.front.y, w: f.front.w, h: f.front.h }, { x: -(30 + o) / 2, y: -30 - o, w: 30, h: 30 });
  assert.equal(f.back.y + f.back.h, 0);
  assert.equal(f.front.ink, 'red');
  // Two eyes 7.5 wide, 2.4 apart, 8.7 down.
  assert.deepEqual(
    f.eyes.map((e) => [Number(e.open.x.toFixed(3)), Number(e.open.w.toFixed(3)), Number((e.open.y - f.front.y).toFixed(3))]),
    [[f.front.x + 6.3, 7.5, 8.7], [f.front.x + 16.2, 7.5, 8.7]].map(([x, w, y]) => [Number(x.toFixed(3)), w, y]),
  );
  assert.equal(f.marks.length, 0);
});

test('a swap puts amber in front; from behind the other block is nearer', () => {
  const look = { design: 'plain', shape: 'square', swap: true };
  assert.equal(figure(look, { size: 20, body }).front.ink, 'amber');
  assert.equal(figure(look, { size: 20, body, facing: 'back' }).front.ink, 'red');
});

test('a visor follows the look; side on, the whole part turns', () => {
  const cap = { design: 'cap', shape: 'square', swap: false };
  const visor = (st) => figure(cap, { size: 20, body, ...st }).marks[1];
  assert.ok(visor({ gaze: [1, 0] }).x > visor({ gaze: [-1, 0] }).x);
  assert.ok(visor({ facing: 'side', toward: 1 }).x > visor({ facing: 'side', toward: -1 }).x);
});

test('hats reach above the block, by the part', () => {
  const rise = (design) => {
    const f = figure({ design, shape: 'square', swap: false }, { size: 100, body });
    return Math.round(f.front.y - f.bounds.y);
  };
  assert.equal(rise('plain'), 0);
  assert.equal(rise('top-hat'), 56);
  assert.equal(rise('antenna'), 42);
});

test('a pick wears a design nobody here wears, while there is one', () => {
  const rand = seeded(7);
  const taken = [];
  for (let i = 0; i < DESIGNS.length; i++) taken.push(pickLook(taken, rand));
  assert.equal(new Set(taken.map((l) => l.design)).size, DESIGNS.length);
  // Then a look nobody has.
  const next = pickLook(taken, rand);
  assert.ok(!taken.some((l) => lookKey(l) === lookKey(next)));
  assert.ok(SHAPES.includes(next.shape));
});

test('a stored look reads back, or not at all', () => {
  assert.deepEqual(readLook({ design: 'chef', shape: 'tall', swap: true }), { design: 'chef', shape: 'tall', swap: true });
  assert.equal(readLook({ design: 'gone', shape: 'tall', swap: true }), null);
  assert.equal(readLook({ design: 'chef', shape: 'round', swap: true }), null);
  assert.equal(readLook({ design: 'chef', shape: 'tall' }), null);
  assert.equal(readLook(null), null);
});

test('each agent keeps its look; a newcomer gets one nobody here has; the gone drop out', () => {
  const rand = seeded(3);
  const first = assignLooks({}, ['a', 'b'], rand);
  assert.notEqual(first.a.design, first.b.design);
  assert.equal(assignLooks(first, ['a', 'b'], rand), first);
  const more = assignLooks(first, ['a', 'b', 'c'], rand);
  assert.equal(more.a, first.a);
  assert.ok(![more.a.design, more.b.design].includes(more.c.design));
  const fewer = assignLooks(more, ['b', 'c'], rand);
  assert.deepEqual(Object.keys(fewer), ['b', 'c']);
  // An empty list is one that could not be read: keep them all.
  assert.equal(assignLooks(more, [], rand), more);
});
