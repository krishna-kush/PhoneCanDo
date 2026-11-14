// The score's promises, read from its notes before any sound is made:
// every note tied to the picture sits exactly on its moment, the narrator
// speaks on each shot's line and is cut off where the action says, the
// hook is whole at the drop, and the plan is silent for the stare at the
// gate and from the first tap to the drop.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockOf } from '../../../engine/sound/clock.ts';
import { STOP } from '../../../engine/sound/score/plan.ts';
import { stageOf } from '../../../engine/sound/score/play.ts';
import { LINE, START, TEMPO } from '../beats.ts';
import { MOMENTS } from '../script/moments.ts';
import { chordAt, CHORDS, DRONE, HARMONY } from './harmony.ts';
import { KIT } from './kit.ts';
import type { Note } from './notes.ts';
import { CHANGES, KINDS, planOf, type Kind } from './plan.ts';
import { notesOf, scoreOf } from './score.ts';
import { GRAB, GRACE, PICKUP } from './sections/dawn.ts';
import { BEFORE, BLINK, PACE, PEEK } from './sections/end.ts';
import { TIPTOE, twinkle } from './sections/lights.ts';
import { climbOf, HOOK_AT } from './sections/crew.ts';
import { RUNNING } from './sections/tools.ts';
import { BARS, HANG, HOME, HOOK, LAMPS, NARRATOR, POPS, RESOLVE, STUMBLE } from './themes.ts';
import { TRACKS, type TrackId } from './tracks.ts';

const m = MOMENTS;
const plan = planOf(CHANGES, LINE.total);
const played = notesOf(plan);
const all: Note[] = played.flatMap((x) => x.notes);

/** The pitches [track] starts exactly on [at], lowest first. */
const on = (track: TrackId, at: number) => all.filter((n) => n.track === track && n.at === at).map((n) => n.midi).sort((a, b) => a - b);

/** [track]'s notes starting in [from, to), in time order. */
const within = (track: TrackId, from: number, to: number) => all.filter((n) => n.track === track && n.at >= from && n.at < to).sort((a, b) => a.at - b.at);

const spanOf = (kind: Kind) => {
  const span = plan.spans.find((s) => s.kind === kind);
  assert.ok(span, kind);
  return span;
};

test('every section plays, and every note can be played: a known track, inside the film, a real length and level', () => {
  for (const kind of Object.keys(KINDS) as Kind[]) assert.ok(played.some((x) => x.span.kind === kind && x.notes.length > 0), `${kind} plays`);
  const drums = new Set<number>(Object.values(KIT));
  for (const n of all) {
    assert.ok(n.track in TRACKS, n.track);
    assert.ok([n.at, n.midi, n.len, n.vel].every(Number.isFinite), 'every number is one');
    assert.ok(n.at >= 0 && n.at < LINE.total, `${n.track} at ${n.at} is outside the film`);
    assert.ok(n.len > 0 && n.vel > 0 && n.vel <= 1.25, `${n.track} at ${n.at}: len ${n.len}, vel ${n.vel}`);
    if (['kick', 'drums', 'hats', 'crash'].includes(n.track)) assert.ok(drums.has(n.midi), `${n.track} at ${n.at} is no drum`);
    else assert.ok(n.midi >= 33 && n.midi <= 96, `${n.track} at ${n.at}: note ${n.midi}`);
  }
});

test('the narrator speaks on each shot’s line and never finishes: the action cuts him off', () => {
  /** How many notes of his theme he gets out, and the moment that stops him. */
  const said: [line: number, notes: number, cut: number][] = [
    [m.lights.line, 5, m.lights.hop],
    [m.crew.line, 2, m.crew.pops[0]],
    [m.tools.line, 2, RUNNING],
    [m.gate.line, 4, m.gate.bonks[0]],
    [m.chores.line, 2, m.chores.done[0]],
    [m.song.line, 2, m.song.taps[0]],
    [m.dawn.line, 4, m.dawn.line + HANG],
  ];
  for (const [line, count, cut] of said) {
    const phrase = within('narrator', line, line + 4);
    assert.deepEqual(phrase.map((n) => [n.at - line, n.midi]), NARRATOR.slice(0, count).map(([at, midi]) => [at, midi]), `the theme from beat ${line}`);
    const last = phrase[phrase.length - 1];
    assert.ok(last.at + last.len <= cut + 1e-9, `cut off by beat ${cut}`);
  }
  // Only in the dark, with nobody up yet, is the hanging B heard: left hanging.
  assert.equal(within('narrator', m.lights.line, START.crew).at(-1)?.midi, RESOLVE[0]);
});

test('at dawn he is right: B2 falls to C3 on the moment, over C major; at the end the theme is whole, paced by the screen', () => {
  const [hang, home] = RESOLVE;
  assert.deepEqual(on('narrator', m.dawn.right - PICKUP), [hang]);
  assert.deepEqual(on('narrator', m.dawn.right), [home]);
  assert.equal(chordAt(m.dawn.right), CHORDS.C);
  assert.deepEqual(on('pad', m.dawn.right), [CHORDS.C.root, ...CHORDS.C.tones]);

  assert.deepEqual(within('narrator', START.end, LINE.total).map((n) => [n.at, n.midi]), HOME.map((midi, i) => [PACE[i], midi]));
  assert.deepEqual([PACE[0], PACE[2], PACE[4], PACE[5]], [m.end.line, m.end.mark, BEFORE, m.end.button]);
  assert.deepEqual([m.end.line, m.end.mark, BEFORE, m.end.button].map((at) => chordAt(at).name), ['C', 'F', 'G', 'C']);
});

test('each lamp is a note of the hook on bell and string, and each floor going dark plays it back down', () => {
  m.lights.lamps.forEach((at, i) => {
    assert.deepEqual(on('bell', at), [LAMPS[i]]);
    assert.deepEqual(on('pizz', at), [LAMPS[i]]);
  });
  m.dawn.out.forEach((at, i) => {
    assert.deepEqual(on('bell', at), [LAMPS[LAMPS.length - 1 - i]]);
    assert.ok(on('pizz', at).includes(LAMPS[LAMPS.length - 1 - i]));
  });
  assert.deepEqual(on('pizz', m.lights.wake), [76], 'one curious E5 as A-01 wakes');
});

test('each yawn is a note of the twinkle, each pop a note of the run, with a bell on the last', () => {
  m.lights.yawns.forEach((at, i) => assert.ok(on('marimba', at).includes(twinkle(i)), `yawn ${i}`));
  m.crew.pops.forEach((at, i) => assert.deepEqual(on('marimba', at), [POPS[i]], `pop ${i}`));
  const last = m.crew.pops.length - 1;
  assert.deepEqual(on('bell', m.crew.pops[last]), [POPS[last]]);
  assert.equal(all.filter((n) => n.track === 'bell' && m.crew.pops.includes(n.at)).length, 1, 'only the last pop has a bell');
});

test('the tiptoe starts once the lamps are on; the hook’s first whole bar is plucked after the pops, a line climbing under it', () => {
  assert.equal(TIPTOE, 8);
  assert.equal(within('pizz', 0, TIPTOE).filter((n) => n.midi < 57).length, 0, 'no bass before it');
  assert.deepEqual(within('pizz', TIPTOE, m.crew.climb).filter((n) => n.midi < 57).map((n) => [n.at, n.midi]), [8, 10, 12, 14, 16, 18, 20].map((at) => [at, at % 4 === 0 ? 45 : 40]), 'A2 on beat 1, E2 on beat 3');
  assert.ok(HOOK_AT >= m.crew.pops[m.crew.pops.length - 1] && HOOK_AT >= m.crew.write);
  const plucked = within('pizz', HOOK_AT, START.tools).filter((n) => n.midi >= 57);
  assert.deepEqual(plucked.map((n) => [(n.at - HOOK_AT) * 4, n.midi]), HOOK.Am.map(([s, midi]) => [s, midi]));
  const climb = within('marimba', m.crew.climb, START.tools);
  climb.forEach((n, k) => {
    assert.equal(n.at, m.crew.climb + k / 4, 'a note every quarter beat');
    assert.equal(n.midi, climbOf(k));
    if (k) assert.ok(n.midi - climb[k - 1].midi === 1 || n.midi - climb[k - 1].midi === 2, 'rising by step');
  });
  assert.equal(climb.at(-1)?.at, START.tools - 0.25, 'up to the end of the shot');
});

test('the march trips on the first bonk: a note a bonk down to the F bar’s A4, a thud on the last, nothing after it', () => {
  const bonk = m.gate.bonks[0];
  assert.deepEqual(within('lead', m.gate.march, bonk).map((n) => [(n.at - m.gate.march) * 4, n.midi]), HOOK.Am.filter(([s]) => m.gate.march + s / 4 < bonk).map(([s, midi]) => [s, midi]));
  assert.deepEqual(within('drums', m.gate.march, bonk).map((n) => n.at), [32, 32.5, 33, 33.5, 34, 34.5], 'a snare on the 8ths');
  m.gate.bonks.forEach((at, i) => {
    assert.deepEqual(on('lead', at), [STUMBLE[i]]);
    assert.deepEqual(on('marimba', at), [STUMBLE[i]]);
  });
  const last = m.gate.bonks[m.gate.bonks.length - 1];
  assert.deepEqual(on('kick', last), [KIT.thump]);
  assert.deepEqual(on('pizz', last), [CHORDS.F.root, CHORDS.F.root + 12]);
  assert.equal(all.filter((n) => n.at > last && n.at < m.gate.scan[0]).length, 0);
});

test('the gate opens into A major: the scan’s pad on E, a stab and bells on the stamp, the hook’s opening as a cheer', () => {
  const [from, until] = m.gate.scan;
  assert.deepEqual(on('pad', from), [52, 57, 59, 64], 'E with its fourth');
  assert.deepEqual(on('pad', (from + until) / 2), [52, 56, 59, 64], 'the fourth falls to the third');
  assert.deepEqual(on('kick', from), [KIT.thump], 'a heartbeat');
  assert.deepEqual(on('stab', m.gate.armed), [57, 61, 64, 69]);
  assert.deepEqual([0, 1, 2, 3].map((k) => on('bell', m.gate.armed + k / 8)[0]), [69, 73, 76, 81], 'bells up A major');
  assert.deepEqual(within('marimba', m.gate.cheer, m.gate.write - 0.25).map((n) => [n.at, n.midi]), [[m.gate.cheer, 69], [m.gate.cheer + 0.5, 73], [m.gate.cheer + 1, 76]]);
  assert.deepEqual(on('stab', m.gate.write), [...CHORDS.D.tones], 'D under the ta-da');
  assert.ok(within('drums', m.gate.through, START.chores).length >= 6, 'a roll as they walk through');
});

test('each DONE stamp is a clap and a stab, the chords climbing Am, C, D, E; the build is cut dead at its end', () => {
  assert.deepEqual(m.chores.done.map((at) => chordAt(at).name), ['Am', 'C', 'D', 'E']);
  for (const at of m.chores.done) {
    const { tones } = chordAt(at);
    assert.deepEqual(on('stab', at), [...tones, tones[0] + 12]);
    assert.ok(on('drums', at).includes(KIT.clap));
  }
  const build = spanOf('chores');
  assert.deepEqual(within('kick', build.from, build.to).map((n) => n.at), [44, 45, 46, 47, 48, 49, 50, 51], 'a kick on every beat');
  assert.equal(build.limit, m.song.line, 'nothing it plays sounds past the narrator’s line');
  assert.ok(plan.cuts.includes(m.song.line), 'and its echo and room are emptied there');
});

test('the drop: the hook on lead and marimba over Am, F, C, four on the floor, a crash on the drop and on the C bar', () => {
  const { drop } = m.song;
  const bell = m.dawn.bell[0];
  for (const track of ['lead', 'marimba'] as const) {
    const sung = within(track, drop, bell).map((n) => [n.at, n.midi]);
    const written = BARS.slice(0, 3).flatMap((bar, k) => HOOK[bar].map(([s, midi]) => [drop + k * TEMPO.bar + s / 4, midi]));
    assert.deepEqual(sung, written, `${track} plays the hook's first three bars`);
  }
  assert.deepEqual([0, 1, 2].map((k) => chordAt(drop + k * TEMPO.bar).name), ['Am', 'F', 'C']);
  assert.deepEqual(within('kick', drop, bell).map((n) => n.at), Array.from({ length: bell - drop }, (_, k) => drop + k));
  assert.deepEqual(within('crash', drop, bell).map((n) => n.at), [drop, drop + 2 * TEMPO.bar]);
  assert.deepEqual(within('drums', drop, drop + TEMPO.bar).filter((n) => n.midi === KIT.clap).map((n) => n.at), [drop + 1, drop + 3], 'a clap on 2 and 4');
  assert.deepEqual(on('stab', m.song.write), [...CHORDS.Am.tones.map((t) => t + 12)].sort((a, b) => a - b), 'a stab an octave up for the fix');
  // The fourth bar only starts: the tape stop takes it.
  assert.equal(spanOf('drop').to, bell + STOP);
});

test('dawn: the chase runs with the scramble, the hat gets a tiptoe and a grace note, the card a music box', () => {
  const [run, bed] = m.dawn.scramble;
  const chase = all.filter((n) => n.track === 'drums' && n.midi === KIT.brush);
  assert.ok(chase.length > 0 && chase.every((n) => n.at >= run && n.at < bed), 'the brushes stay inside the scramble');
  // The tune's notes are its shortest: the bass and the lights-out notes are held longer.
  const tune = within('pizz', run, bed).filter((n) => n.len < 0.2);
  assert.deepEqual(tune.filter((n) => n.at >= m.dawn.line && n.at < m.dawn.line + 2).map((n) => [(n.at - m.dawn.line) * 8, n.midi]), HOOK.Am.map(([s, midi]) => [s, midi]), 'the hook at double speed');
  assert.ok(tune[0].vel > tune[tune.length - 1].vel, 'quieter as it goes');

  const [dart, back] = m.dawn.hat;
  assert.deepEqual(within('pizz', dart, back).map((n) => [n.at, n.midi]), [[dart, 45], [dart + 0.5, 40], [dart + 1, 45], [dart + 1.5, 40]]);
  assert.deepEqual(on('marimba', m.dawn.grab - GRACE), [GRAB[0]]);
  assert.deepEqual(on('marimba', m.dawn.grab), [GRAB[1]]);

  // An 8th where the hook has a 16th, in C major, until the end starts.
  assert.deepEqual(within('bell', m.dawn.card, START.end).map((n) => [(n.at - m.dawn.card) * 2, n.midi]), HOOK.C.filter(([s]) => m.dawn.card + s / 2 < START.end).map(([s, midi]) => [s, midi]));
});

test('the end: the hook’s C bar on marimba and bell together, soft drums from the mark, the button’s chord left to ring', () => {
  const { line, mark, button, peek, blink, ding } = m.end;
  for (const track of ['marimba', 'bell'] as const) {
    assert.deepEqual(within(track, line, button).map((n) => [(n.at - line) * 4, n.midi]), HOOK.C.map(([s, midi]) => [s, midi]));
  }
  assert.equal(within('kick', START.end, mark).length + within('hats', START.end, mark).length, 0, 'no drums before the mark');
  assert.deepEqual(within('kick', mark, LINE.total).map((n) => n.at), [mark, mark + 1]);
  const ring = all.filter((n) => n.track === 'stab' && n.at === button);
  assert.deepEqual(ring.map((n) => n.midi), [48, 55, 60, 64, 67, 72], 'C major');
  assert.ok(ring.every((n) => n.at + n.len < ding), 'rung out before the last ding');
  assert.deepEqual(on('pizz', peek), [PEEK]);
  assert.deepEqual(on('bell', blink), [BLINK]);
  assert.equal(all.filter((n) => n.at > blink).length, 0, 'nothing more: the last ding has the end to itself');
});

test('the plan: silence for the stare and from the first tap to the drop, a tape stop on the bell', () => {
  assert.deepEqual(plan.silences, [
    { from: m.gate.look, to: m.gate.scan[0] },
    { from: m.song.taps[0], to: m.song.drop },
    { from: m.dawn.bell[0] + STOP, to: m.dawn.scramble[0] },
  ]);
  assert.deepEqual(plan.stops, [{ from: m.dawn.bell[0], to: m.dawn.bell[0] + STOP }]);
  for (const q of plan.silences) assert.equal(all.filter((n) => n.at >= q.from && n.at < q.to).length, 0, `no note starts from beat ${q.from} to ${q.to}`);
  // From his line to the drop the narrator is the only one playing, and only up to the first tap.
  const hush = all.filter((n) => n.at >= m.song.line && n.at < m.song.drop);
  assert.ok(hush.length > 0 && hush.every((n) => n.track === 'narrator' && n.at + n.len <= m.song.taps[0] + 1e-9));
  assert.equal(spanOf('march').limit, m.gate.look);
  assert.equal(spanOf('hush').limit, m.song.taps[0]);
});

test('the harmony changes in time order, and the night’s pad has no third', () => {
  HARMONY.forEach((h, i) => assert.ok(i === 0 || h.at > HARMONY[i - 1].at, `the change at beat ${h.at} is out of order`));
  assert.equal(chordAt(m.lights.line).name, 'Am');
  assert.equal(chordAt(m.gate.armed).name, 'A');
  assert.equal(chordAt(m.dawn.card).name, 'C');
  assert.deepEqual(DRONE.map((n) => (n - 45) % 12), [0, 7, 0]);
  assert.deepEqual(on('pad', m.lights.line), [...DRONE]);
});

test('played: only the narrator sounds from his line to the first tap, nothing from there to the drop, and every track is used', () => {
  const clock = clockOf(TEMPO);
  const { sampleOf } = clock;
  const names = Object.keys(TRACKS) as TrackId[];
  const stage = stageOf(clock, names, sampleOf(LINE.total));
  scoreOf(LINE.total).play(stage);
  const peak = (t: TrackId, from: number, to: number) => {
    let p = 0;
    for (let i = sampleOf(from); i < sampleOf(to); i++) p = Math.max(p, Math.abs(stage.tracks[t].l[i]), Math.abs(stage.tracks[t].r[i]));
    return p;
  };
  for (const t of names) {
    assert.ok(peak(t, 0, LINE.total) > 0, `${t} plays`);
    assert.ok(Number.isFinite(peak(t, 0, LINE.total)), `${t} is finite`);
    if (t !== 'narrator') assert.equal(peak(t, m.song.line, m.song.drop), 0, `${t} is silent from the line to the drop`);
    assert.equal(peak(t, m.gate.look, m.gate.scan[0]), 0, `${t} is silent for the stare`);
  }
  assert.ok(peak('narrator', m.song.line, m.song.taps[0]) > 0, 'the narrator is there');
  assert.equal(peak('narrator', m.song.taps[0], m.song.drop), 0, 'and the first tap cuts him off');
  assert.ok(stage.pumps.length > 0, 'the kicks pump');
});
