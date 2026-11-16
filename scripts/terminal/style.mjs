// Terminal colours for our scripts (./manage, the release script): only when
// stdout is a terminal and NO_COLOR is unset, so logs and pipes stay plain.
const on = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const color = (code) => (text) => (on ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const red = color(31);
export const green = color(32);
export const yellow = color(33);
export const cyan = color(36);
export const bold = color(1);
export const dim = color(2);

/** The release preflight report's paints: report.mjs stays pure and takes these. */
export const PAINT = { good: green, bad: red, warn: yellow, dim, bold };

/** One step of a longer run (build, release), set off from what came before. */
export function heading(text) {
  console.log(`\n${bold(`== ${text}`)}`);
}
