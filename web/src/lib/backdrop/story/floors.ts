// Which chapter plays on which floor, by the part of the page beside it. A
// chapter is A-07's story with its props in the right margin and a cast on a
// loop in the left. A part with no chapter of its own (a section added
// later) gets a floor of wanderers, and A-07 just passes through it.

import type { Gear } from '../species/look';
import type { Scene, Story } from '../world/frame';
import type { Room } from './room';
import * as archive from './chapters/archive/story';
import { cast as archiveCast } from './chapters/archive/cast';
import * as basement from './chapters/basement/story';
import { cast as basementCast } from './chapters/basement/cast';
import * as dock from './chapters/dock/story';
import { cast as dockCast } from './chapters/dock/cast';
import * as fineprint from './chapters/fineprint/story';
import { cast as fineprintCast } from './chapters/fineprint/cast';
import * as glass from './chapters/glass/story';
import { cast as glassCast } from './chapters/glass/cast';
import * as lineup from './chapters/lineup/story';
import { cast as lineupCast } from './chapters/lineup/cast';
import * as night from './chapters/night/story';
import { cast as nightCast } from './chapters/night/cast';
import * as quarters from './chapters/quarters/story';
import { cast as quartersCast } from './chapters/quarters/cast';
import * as screen from './chapters/screen/story';
import { cast as screenCast } from './chapters/screen/cast';
import * as vault from './chapters/vault/story';
import { cast as vaultCast } from './chapters/vault/cast';

type Chapter = { story: Story; stage: (room: Room) => void };

const chapter = ({ story, stage }: Chapter, cast: (room: Room) => void, gear: Gear[]): Scene => ({
  crowd: { count: 2, gear },
  story,
  draw: (room) => (room.side > 0 ? stage(room) : cast(room)),
});

const scenes: Record<string, Scene> = {
  hero: chapter(glass, glassCast, ['none', 'antenna', 'cap']),
  demos: chapter(screen, screenCast, ['none', 'headset', 'glasses']),
  models: chapter(lineup, lineupCast, ['antenna', 'cap', 'bow']),
  linux: chapter(basement, basementCast, ['hardhat']),
  crew: chapter(quarters, quartersCast, ['none', 'headset', 'antenna']),
  gate: chapter(vault, vaultCast, ['none', 'cap']),
  install: chapter(dock, dockCast, ['none', 'cap', 'bow']),
  source: chapter(archive, archiveCast, ['glasses', 'none']),
  faq: chapter(fineprint, fineprintCast, ['none', 'antenna', 'glasses']),
  footer: { ...chapter(night, nightCast, []), crowd: undefined },
};

const plain: Scene = { crowd: { count: 3, gear: ['none', 'antenna', 'cap', 'headset'] }, draw: () => {} };

export const sceneFor = (key: string): Scene => scenes[key] ?? plain;
