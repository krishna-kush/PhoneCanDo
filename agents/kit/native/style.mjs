// Terminal colours for the kit's native scripts: only when stdout is a
// terminal and NO_COLOR is unset, so logs and pipes stay plain text.
const on = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const color = (code) => (text) => (on ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const red = color(31);
export const green = color(32);
export const yellow = color(33);
export const bold = color(1);
export const dim = color(2);

/** A staged payload's state in its colour: current green, outdated red, missing yellow. */
export const stateColor = { current: green, outdated: red, missing: yellow };
