// What the splash plays: the plain brand mark, held still, then a squash,
// a hop up as its eyes pop open wide and it becomes A-01, a bouncy landing,
// a look about and a blink. Its first frame is the mark alone, as the
// launcher icon shows it and as a phone below Android 12 keeps it. The
// story fits the first second, the most Android 12 animates, and ends on
// the face at rest, where 12 stops it. From 13 nothing stops the icon but
// the splash going, so IDLE then plays over and over: a double blink and a
// look about, so a slow start never sits on a still face. It is cut
// wherever the app is ready, so the eyes are open by 300 ms.
//
// Each line is [ms, value, ease?], the ease for the stretch that ends there.
// Lids are mascot/layout/eyes.ts's shares of the eye (0 none, 1.24 wide),
// gaze its -1 to 1 (0.5 where an awake face rests), moves are shares of the
// block's side. A blink is how much of the eye its lid leaves showing (1
// open, 0.15 shut, as eyes.ts's shut eye): the lid comes down from the top
// over the pupil, fast and speeding up, and goes back up slower, and the
// body dips a little with it, so a blink reads as a living one.

/** The last moment of the story, so every line holds to the end. */
export const STORY_MS = 1000;

export const STORY = {
  body: {
    // Still, the squash, the stretch up, the landing, settled, the blink's dip.
    sx: [[0, 1], [140, 1], [220, 1.06, 'in'], [300, 0.95, 'pop'], [420, 1.04, 'in'], [540, 1, 'settle'], [840, 1], [900, 1.012, 'in'], [1000, 1, 'out']],
    sy: [[0, 1], [140, 1], [220, 0.9, 'in'], [300, 1.06, 'pop'], [420, 0.94, 'in'], [540, 1, 'settle'], [840, 1], [900, 0.975, 'in'], [1000, 1, 'out']],
    lift: [[0, 0], [220, 0], [320, -0.1, 'out'], [420, 0, 'in']],
  },
  eyes: {
    lid: [[0, 0], [220, 0], [290, 1.24, 'pop'], [460, 1.24], [560, 1, 'settle']],
    // No pupil until the eye is half open (mascot/layout/eyes.ts).
    pupil: [[0, 0], [250, 0], [270, 1]],
    gaze: [[0, 0.5], [560, 0.5], [600, -1, 'swap'], [670, -1], [710, 1, 'swap'], [780, 1], [820, 0.5, 'swap']],
    blink: [[0, 1], [840, 1], [900, 0.15, 'in'], [920, 0.15], [1000, 1, 'out']],
  },
};

/** One round of IDLE, from the face at rest back to it. */
export const IDLE_MS = 3000;

// After the story, round after round until the app is ready: a still face,
// a double blink (the second a touch quicker, as a real one is), then a
// slower look about than the story's, and still again.
export const IDLE = {
  body: {
    // The blinks' dips, the body coming back a little after the lids.
    sx: [[0, 1], [700, 1], [770, 1.012, 'in'], [980, 1, 'out'], [1040, 1], [1100, 1.008, 'in'], [1300, 1, 'out']],
    sy: [[0, 1], [700, 1], [770, 0.975, 'in'], [980, 1, 'out'], [1040, 1], [1100, 0.982, 'in'], [1300, 1, 'out']],
  },
  eyes: {
    blink: [[0, 1], [700, 1], [770, 0.15, 'in'], [800, 0.15], [940, 1, 'out'], [1040, 1], [1100, 0.15, 'in'], [1120, 0.15], [1260, 1, 'out']],
    gaze: [[0, 0.5], [1500, 0.5], [1580, -1, 'swap'], [1900, -1], [2000, 1, 'swap'], [2300, 1], [2380, 0.5, 'swap']],
  },
};

/** The eases by name: the logo loader's two (theme/logo.json) and ours. */
export function easesOf(logo) {
  return {
    pop: logo.loader.ease,
    swap: logo.loader.swapEase,
    in: [0.55, 0, 1, 0.45],
    out: [0, 0.55, 0.45, 1],
    settle: [0.34, 1.56, 0.64, 1],
  };
}
