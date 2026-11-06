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
  models: 'thinking…',
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
