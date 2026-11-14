// The timeline's promises: scenes on bar lines, every sound inside its
// scene, the music's changes in order, and the deal sized by the facts.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sectionsOf, soundsOf } from './cues.ts';
import { SCENES, sceneAt, startOf, TOTAL } from './scenes.ts';
import { SECTIONS } from './music.ts';
import { SFX } from './sfx.ts';
import { BAR } from './tempo.ts';

const facts = { agents: ['opencode', 'Aider', 'Claude Code'] };

test('every scene starts on a bar line and the whole is whole bars', () => {
  for (const s of SCENES) assert.equal(startOf(s.id) % BAR, 0, s.id);
  assert.equal(TOTAL % BAR, 0);
});

test('sceneAt finds each scene from its first beat', () => {
  for (const s of SCENES) {
    const { scene, local } = sceneAt(startOf(s.id));
    assert.equal(scene.id, s.id);
    assert.equal(local, 0);
  }
});

test('every sound is a known one and lands inside its own scene', () => {
  for (const c of soundsOf(facts)) {
    assert.ok(c.sfx in SFX, c.sfx);
    const s = SCENES.find((x) => x.id === c.scene);
    assert.ok(s);
    assert.ok(c.at >= startOf(s.id) && c.at < startOf(s.id) + s.beats, `${c.sfx} at ${c.at} outside ${s.id}`);
  }
});

test('the music changes in time order, each to a known section', () => {
  const all = sectionsOf();
  assert.equal(all[0].at, 0);
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i].at > all[i - 1].at);
    assert.notEqual(all[i].section, all[i - 1].section);
  }
  for (const s of all) assert.ok(s.section in SECTIONS);
});

test('the deal flicks one card for each agent kind', () => {
  const cards = (agents: string[]) => soundsOf({ agents }).filter((c) => c.sfx === 'card').length;
  assert.equal(cards(facts.agents), 3);
  assert.equal(cards([...facts.agents, 'pi', 'goose']), 5);
});
