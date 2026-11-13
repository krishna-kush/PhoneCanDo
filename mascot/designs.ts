// Every design of the A-series: what a unit wears, one part at most on its
// head, at its neck and on its face (parts/), with a name for a picker.
// Each comes in every shape (body.ts) with either ink in front. A new
// design is a line below; a new part is a file in parts/ and a line in its
// index.

import type { FaceId } from './parts/face/index.ts';
import type { HatId } from './parts/hat/index.ts';
import type { NeckId } from './parts/neck/index.ts';

export type Design = { id: string; name: string; hat?: HatId; neck?: NeckId; face?: FaceId };

export const DESIGNS = [
  { id: 'plain', name: 'Plain' },
  // The website's crew, by the part each plays in its story: the one who
  // writes the code, runs the tests, checks it twice, keeps watch.
  { id: 'coder', name: 'Coder', neck: 'tie', face: 'glasses' },
  { id: 'tester', name: 'Tester', hat: 'capBack' },
  { id: 'checker', name: 'Checker', neck: 'bowtie' },
  { id: 'watch', name: 'Night watch', hat: 'beanie' },
  { id: 'top-hat', name: 'Top hat', hat: 'tophat' },
  { id: 'dj', name: 'DJ', hat: 'headphones' },
  { id: 'intern', name: 'Intern', hat: 'tuft', neck: 'tie' },
  { id: 'antenna', name: 'Antenna', hat: 'antenna' },
  { id: 'coach', name: 'Coach', hat: 'cap', face: 'glasses' },
  { id: 'professor', name: 'Professor', neck: 'bowtie', face: 'glasses' },
  { id: 'tuft', name: 'Tuft', hat: 'tuft' },
  { id: 'cap', name: 'Cap', hat: 'cap' },
  { id: 'producer', name: 'Producer', hat: 'headphones', neck: 'tie' },
  { id: 'butler', name: 'Butler', hat: 'antenna', neck: 'bowtie' },
  { id: 'reader', name: 'Reader', face: 'glasses' },
  { id: 'magician', name: 'Magician', hat: 'tophat', neck: 'bowtie' },
  { id: 'digger', name: 'Digger', hat: 'hardhat' },
  { id: 'foreman', name: 'Foreman', hat: 'hardhat', neck: 'tie' },
  { id: 'support', name: 'Support', hat: 'headset' },
  { id: 'operator', name: 'Operator', hat: 'headset', neck: 'badge' },
  { id: 'royal', name: 'Royal', hat: 'crown' },
  { id: 'monarch', name: 'Monarch', hat: 'crown', neck: 'medal' },
  { id: 'champion', name: 'Champion', neck: 'medal' },
  { id: 'staff', name: 'Staff', neck: 'badge', face: 'glasses' },
  { id: 'whiz', name: 'Whiz kid', hat: 'propeller' },
  { id: 'inventor', name: 'Inventor', hat: 'propeller', face: 'glasses' },
  { id: 'chef', name: 'Chef', hat: 'chef' },
  { id: 'head-chef', name: 'Head chef', hat: 'chef', face: 'mustache' },
  { id: 'wizard', name: 'Wizard', hat: 'wizard' },
  { id: 'sage', name: 'Sage', hat: 'wizard', face: 'mustache' },
  { id: 'party', name: 'Party', hat: 'party' },
  { id: 'birthday', name: 'Birthday', hat: 'party', face: 'blush' },
  { id: 'athlete', name: 'Athlete', hat: 'headband', neck: 'medal' },
  { id: 'angel', name: 'Angel', hat: 'halo' },
  { id: 'imp', name: 'Imp', hat: 'horns' },
  { id: 'kitty', name: 'Kitty', hat: 'catEars', neck: 'collar' },
  { id: 'bunny', name: 'Bunny', hat: 'bunnyEars', face: 'blush' },
  { id: 'sprout', name: 'Sprout', hat: 'sprout' },
  { id: 'punk', name: 'Punk', hat: 'mohawk' },
  { id: 'rocker', name: 'Rocker', hat: 'mohawk', neck: 'collar' },
  { id: 'bun', name: 'Bun', hat: 'bun' },
  { id: 'cowboy', name: 'Cowboy', hat: 'cowboy' },
  { id: 'sheriff', name: 'Sheriff', hat: 'cowboy', neck: 'medal' },
  { id: 'ranger', name: 'Ranger', hat: 'cowboy', neck: 'scarf' },
  { id: 'artist', name: 'Artist', hat: 'beret', face: 'mustache' },
  { id: 'fisher', name: 'Fisher', hat: 'bucket' },
  { id: 'viking', name: 'Viking', hat: 'viking' },
  { id: 'graduate', name: 'Graduate', hat: 'mortarboard', face: 'glasses' },
  { id: 'santa', name: 'Santa', hat: 'santa' },
  { id: 'cool', name: 'Cool', hat: 'shades' },
  { id: 'pilot', name: 'Pilot', hat: 'shades', neck: 'scarf' },
  { id: 'sweetheart', name: 'Sweetheart', hat: 'bow', face: 'blush' },
  { id: 'pirate', name: 'Pirate', hat: 'bandana', face: 'eyepatch' },
  { id: 'wanderer', name: 'Wanderer', neck: 'scarf' },
  { id: 'winter', name: 'Winter', hat: 'beanie', neck: 'scarf' },
  { id: 'gentleman', name: 'Gentleman', hat: 'tophat', face: 'monocle' },
  { id: 'mustache', name: 'Mustache', face: 'mustache' },
  { id: 'shy', name: 'Shy', face: 'blush' },
] as const satisfies readonly Design[];

export type DesignId = (typeof DESIGNS)[number]['id'];

const BY_ID = new Map<string, Design>(DESIGNS.map((d) => [d.id, d]));

/** A design by its id; null for one we no longer have. */
export const designOf = (id: string): Design | null => BY_ID.get(id) ?? null;

export const isDesignId = (id: unknown): id is DesignId => typeof id === 'string' && BY_ID.has(id);
