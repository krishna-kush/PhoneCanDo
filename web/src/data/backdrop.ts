// The backdrop's story, The Phone That Could (components/Backdrop.astro):
// each floor's title on its cut face and its lines of the story, told in the
// right margin over the floor, one more each time the story moves on. Keys
// are the page's parts, as A-01's are (data/mascot.ts). When each line comes
// in is the chapter's (lib/backdrop/story/chapters/). The story speaks to
// the reader: "you" is whoever is reading the page.

export type FloorWords = {
  /** On the floor's cut face, after its number: "CH. 03 · the diggers". 14 characters at most. */
  title: string;
  /** Its part of the story, a line per beat. */
  lines: string[];
  /** The last words of all, set large in red under the lines (the last floor only). */
  coda?: string;
  /** What Little says when clicked on this floor, in turn; 16 characters at most. */
  says: string[];
};

export const floorWords: Record<string, FloorWords> = {
  hero: {
    title: 'a phone',
    lines: [
      'Once, a phone lay on a nightstand, still warm.',
      'You had fallen asleep halfway through an idea. Inside the phone, something small woke up.',
      'Its name was Little, unit A-07. It wanted to help. But it was only a phone.',
    ],
    says: ['shh, you sleep', 'i can help!', 'only a phone?'],
  },
  demos: {
    title: 'the apps',
    lines: [
      'All around it the apps lay asleep on the glass, each in its square.',
      'Little learned to read their names, and then, very carefully, to wake one: a tap.',
      'Messages blinked awake, holding a note from your mom you hadn’t answered yet.',
      'Then Clock. Then Settings, grumbling. One by one, the phone came alive under it.',
    ],
    says: ['tap · tap', 'i can read!', 'wakey wakey'],
  },
  models: {
    title: 'a spark',
    lines: [
      'But to help you it had to think, and every thought had to travel far away and back.',
      'Then, one night, a spark: a mind of its own, small and warm, that never had to leave.',
    ],
    says: ['hello, spark', 'all mine', 'it stays here'],
  },
  linux: {
    title: 'the diggers',
    lines: ['The Diggers came without being asked.', 'All night, under the glass, they dug out a whole machine. Room to build your idea.'],
    says: ['a whole Linux!', 'thank you', 'room to build'],
  },
  crew: {
    title: 'the crew',
    lines: [
      'Others moved in. They passed notes and took turns at the one screen.',
      'Someone was always awake. Little wasn’t alone anymore.',
    ],
    says: ['psst · a note', 'my turn?', 'not alone'],
  },
  gate: {
    title: 'the key',
    lines: [
      'Little could do almost anything now. It could even answer your mom. It didn’t.',
      'Instead it did the hardest thing: it locked itself, and gave the only key to you.',
    ],
    says: ['yours to keep', 'not without you', 'only you'],
  },
  install: {
    title: 'the tunnel',
    lines: [
      'Next morning the train went into the tunnel. No signal, your hands full, and two things that couldn’t wait.',
      'You whispered them: finish my idea, and tell Mom I’m coming. Your touch turned the key.',
      'Little woke Messages and wrote to her, while the crew built the rest, right there on the phone, by the light of the Spark.',
    ],
    says: ['on it', 'no signal? ok', 'we got this'],
  },
  source: {
    title: 'nothing hidden',
    lines: ['On the train, you opened it up, to see how.', 'Little let you read every line.'],
    says: ['read me', 'nothing hidden', 'that’s me'],
  },
  faq: {
    title: 'how?',
    lines: ['The apps gathered round. “How?” they asked.', '“I asked,” said Little. “I learned. I stayed.”'],
    says: ['i asked', 'i learned', 'i stayed'],
  },
  footer: {
    title: 'light',
    lines: [
      'The train came out into the light, and the message went.',
      'Your idea, finished. And from Mom: ❤',
      'You looked at the phone in your hand as if for the first time.',
      'It had never been only a phone.',
    ],
    coda: 'PhoneCanDo.',
    says: ['morning!', 'all done ✓', 'sent ❤'],
  },
};

/**
 * What each crew member does for your idea in the tunnel, in turn: the crew
 * are the agent kinds the Models section leads with, so each gets one part,
 * shown on a callout with its name. 16 characters at most.
 */
export const crewParts = ['writes the code', 'runs the tests', 'checks it twice', 'keeps watch'];

/** What the others say when clicked, in turn; 16 characters at most. */
export const voices = {
  app: ['you rang?', 'five more min…', 'tap me again', 'awake!'],
  drifter: ['send it up…', 'thinking…', 'any minute now', 'still buffering'],
  spark: ['still here!', 'on device', 'all yours', '✦'],
};

/**
 * The apps' playground in the left margin (lib/backdrop/play/): its hints,
 * what the toys and fixtures say, and the count by Mom's house at the end.
 */
export const playWords = {
  /**
   * Two lines each, over the toys: on the first floor until one is awake;
   * then there until three are; then, for a while on the floor you are on,
   * what else your hand can do. 20 characters a line at most.
   */
  hint: {
    first: ['tap one awake', 'then throw it'],
    throw: ['throw it at', 'the sleepers'],
    hands: ['press + shake: quake', 'press + hold: jiggle'],
  },
  awake: (n: number, of: number) => `${n} / ${of} awake`,
  all: 'all awake',
  /** What a sleeper says when you try to pick it up while someone on its floor is awake to throw at it; 16 characters at most. */
  asleep: ['five more min…', 'zzz…', 'bump me awake'],
  /** A run of sleepers one throw woke, one after another. */
  run: (n: number) => `×${n}`,
  /** The dock's name on the deck, and its stamp once every square holds an awake app. */
  dock: 'dock',
  docked: 'docked',
  /** What the padlock on the key's floor says when you click it open; 16 characters at most. */
  lock: ['only with you', 'go on through', 'your key ✓'],
};

/** What your mom wrote, Little's answer, and hers: the task the story carries. */
export const momNote = { asks: 'coming sunday?', reply: 'on my way! ❤', back: '❤' };

/** Your idea, half written on the first floor and finished on the last. */
export const idea = { half: 'it could…', whole: 'a phone that could.' };

/** For a floor with no words of its own. */
export const anyWords: FloorWords = { title: 'floor', lines: [], says: ['hi!', 'on duty'] };

/** A-01's line when a unit in the backdrop is clicked (17 characters at most, data/mascot.ts). */
export const cousinLine = (serial: string) => `hi cousin ${serial}`;
