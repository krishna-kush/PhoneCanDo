// Which chapter of The Phone That Could plays on which floor, by the part of
// the page beside it. A part with no chapter of its own (a section added
// later) is a quiet floor Little passes through.

import type { Scene } from '../world/frame';
import * as nightstand from './chapters/ch00-nightstand';
import * as apps from './chapters/ch01-apps';
import * as spark from './chapters/ch02-spark';
import * as diggers from './chapters/ch03-diggers';
import * as crew from './chapters/ch04-crew';
import * as alarm from './chapters/ch05-alarm';
import * as key from './chapters/ch06-key';
import * as tunnel from './chapters/ch07-tunnel';
import * as blueprint from './chapters/ch08-blueprint';
import * as how from './chapters/ch09-how';
import * as morning from './chapters/ch10-morning';

const scenes: Record<string, Scene> = {
  hero: nightstand,
  demos: apps,
  models: spark,
  linux: diggers,
  crew,
  schedules: alarm,
  gate: key,
  install: tunnel,
  source: blueprint,
  faq: how,
  footer: morning,
};

const quiet: Scene = { draw: () => {} };

export const sceneFor = (key: string): Scene => scenes[key] ?? quiet;
