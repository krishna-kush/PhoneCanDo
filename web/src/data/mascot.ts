// What A-01 says (components/Mascot.astro). Its caption shares a 140px margin
// at 1440px, so a line is 17 characters at most: 18 already runs off the
// left edge of the screen.

/**
 * The line beside each part of the page. Keys are section ids, or the first
 * class where there is none: the hero, the footer, the 404's main.
 */
export const sceneLines: Record<string, string> = {
  hero: 'on duty',
  demos: 'watching plates',
  models: 'open a pack!',
  linux: 'apt install fun',
  gate: '403 · needs you',
  install: 'sideload me',
  faq: 'any questions?',
  source: 'go on · read me',
  footer: 'end of manual',
  missing: '404 · lost too',
  // The privacy note.
  note: 'psst · privacy',
  tldr: 'tl;dr · got it',
  sends: 'packing light',
  never: 'lips sealed',
  controls: "you're the boss",
  site: 'no cookies? :(',
  kept: 'best before…',
  elsewhere: 'who i call',
  questions: 'ask me anything',
};

/**
 * Said when the visitor plays with a toy on the home page; the toys send
 * them through lib/mascotCue.ts. Lists take turns, functions fill in what
 * changed; both stay inside 17 characters.
 */
export const toyLines = {
  verb: (verb: string) => `ai can ${verb}`,
  shuffled: ['shuffled!', 'new deal', 'again! again!', 'plates · mixed'],
  upsideDown: 'wrong way up!',
  upright: 'phew · upright',
  newCards: (n: number) => (n === 1 ? 'new card!' : `${n} new cards!`),
  dupes: 'dupes · again?',
  fullSet: 'full set! ✓',
  brainIn: (name: string) => `${name} in!`,
  seal: ['still 0 shared', 'yep · 0 shared', 'stamp all u like', 'nothing leaks'],
  armed: 'armed · ty!',
  armedIdle: 'armed · by you',
  tooQuick: 'hold it longer',
  relocked: 'locked again',
  step: (n: number, done: boolean) => (done ? `step ${n} ✓` : `step ${n} undone`),
  allSet: 'all set!',
  opened: (n: number, of: number) => `read ${n} of ${of}`,
  audited: 'you read it all!',
  rolled: (q: number) => `rolled Q${q}`,
  allAnswered: 'all answered!',
  apart: 'all on device',
  together: 'clack · intact',
  part: {
    cloud: 'no relay here',
    screen: 'i read pixels',
    apps: 'tap tap tap',
    agent: "that's me!",
    linux: 'my own root',
    keys: 'kept right here',
    board: 'no PC needed',
  },
};

/** Said when a hard spin of the wheel makes it dizzy; never twice in a row. */
export const slowDownLines = [
  'whoa · slow down',
  'brakes! brakes!',
  'my pixels hurt',
  'seatbelt please',
  "room's spinning",
  'are we there yet',
  'speedrun any%?',
  'tl;dr much?',
  'ctrl+z · ctrl+z',
  'i feel queasy',
  'warp speed?!',
  'wheee · wait no',
  'g-forces!',
  'read, not race',
  'lost my lunch',
  'scroll gently pls',
  'hold me',
  'skimming, huh?',
];
