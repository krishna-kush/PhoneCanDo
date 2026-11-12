// The backdrop's words (components/Backdrop.astro): each floor's name and
// motto on its cut face, its chapter of A-07's story, and what its units say
// when clicked. Keys are the page's parts, as A-01's are (data/mascot.ts). A
// floor's label shares a margin as narrow as 140px, so a name or motto is 14
// characters at most; the words on a chapter's own props (a typed line, a
// crate's label) live with that chapter in lib/backdrop/story/chapters/.

export type FloorWords = {
  /** The floor's name, after its number: "L03 · the basement". */
  level: string;
  /** Its line in the other margin. */
  motto: string;
  /** Its chapter of A-07's story, in a sentence: the caption over the floor. */
  caption: string;
  /** What its units say when clicked, in turn; 16 characters at most. */
  says: string[];
};

export const floorWords: Record<string, FloorWords> = {
  hero: {
    level: 'the glass',
    motto: 'no cloud relay',
    caption: 'A-07 unplugs from the cloud.',
    says: ['on device!', 'cord cut!', 'tap tap tap', 'no PC needed'],
  },
  demos: {
    level: 'the screen',
    motto: 'just ask',
    caption: 'A-07 learns to use the phone.',
    says: ['i read pixels', 'typing…', 'copied!', 'shared ✓'],
  },
  models: {
    level: 'the lineup',
    motto: 'pick its brain',
    caption: 'A-07 picks a brain of its own.',
    says: ['pick me!', 'new brain!', 'runs local', 'own sign-in'],
  },
  linux: {
    level: 'the basement',
    motto: 'own root',
    caption: 'A-07 gets a machine of its own.',
    says: ['apt install fun', 'my own root', 'pkg in!', 'hard hat on'],
  },
  crew: {
    level: 'crew quarters',
    motto: 'pass it on',
    caption: 'A-07 meets the crew.',
    says: ['psst · a note', 'my turn!', 'all hands!', 'wake me later'],
  },
  gate: {
    level: 'the vault',
    motto: 'ships locked',
    caption: "A-07 can't arm itself. You can.",
    says: ['locked · ok', 'only you arm it', "can't arm myself", 'armed · ty!'],
  },
  install: {
    level: 'loading dock',
    motto: 'sideload me',
    caption: 'A-07 helps the next one in.',
    says: ['fresh install!', 'hi!', 'coffee first', 'no store'],
  },
  source: {
    level: 'the archive',
    motto: 'read the code',
    caption: 'A-07 reads its own blueprint.',
    says: ['read me', 'all on GitHub', 'LGTM', 'no secrets'],
  },
  faq: {
    level: 'fine print',
    motto: 'ask away',
    caption: 'A-07 has questions.',
    says: ['good question', 'roll again', 'see the FAQ', 'hmm…'],
  },
  footer: {
    level: 'night shift',
    motto: 'all-nighters',
    caption: 'A-07 keeps a job running all night.',
    says: ['zz…', '5 more min', 'still running', 'night night'],
  },
};

/** For a floor with no words of its own. */
export const anyWords: FloorWords = {
  level: 'floor',
  motto: 'on duty',
  caption: 'A-07 passes through.',
  says: ['hi!', 'beep', 'boop', 'on duty'],
};

/** A-01's line when a cousin is clicked (17 characters at most, data/mascot.ts). */
export const cousinLine = (serial: string) => `hi cousin ${serial}`;
