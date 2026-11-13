// The first shift's dares: fun first things to try, rolled like a die.
// Chat dares go in the agent's chat (copied, then pasted); shell dares are
// typed into the machine's terminal for you, without Enter; hands dares
// need phone control. Each works on a fresh agent with nothing installed
// past the Default image (Debian with python3 and curl), or Android's own
// shell where there is no Linux. Pure (zero RN imports).

export type DareSet = 'chat' | 'shell' | 'hands';

const CHAT_LINUX = [
  'Tell me about the Linux machine you live in: distro, CPU and memory, as a tidy table.',
  'Make a tiny web page with a bouncing square, serve it on this phone, and tell me the address to open in my browser.',
  'Write a haiku about living inside a phone.',
  'Make a number-guessing game in Python I can play in the terminal, and tell me how to start it.',
  'Draw an ASCII-art cat into cat.txt and show it to me.',
  'Plan a 15-minute workout I can do in a small room, as a checklist.',
];

const CHAT_ANDROID = [
  'Tell me about this phone: model, Android version, CPU and memory, as a tidy table.',
  'Write a haiku about living inside a phone.',
  'Draw an ASCII-art cat into cat.txt and show it to me.',
  'Plan a 15-minute workout I can do in a small room, as a checklist.',
];

const SHELL_LINUX = [
  // A steam train runs across the screen.
  'apt update && apt install -y sl && /usr/games/sl',
  // Is it real? It is.
  'cat /etc/os-release | head -2 && uname -m',
  'python3 -c "print(\'hello from Python on a phone\')"',
];

const SHELL_ANDROID = ['getprop ro.product.model && uname -m', 'echo "hello from $(getprop ro.product.model)"'];

const HANDS = [
  'Open the Clock app and set a timer for 1 minute.',
  'Open Settings and tell me which Android version this phone runs.',
  'Turn on Do Not Disturb until 9 tomorrow morning.',
];

export function daresFor(set: DareSet, linux: boolean): readonly string[] {
  if (set === 'hands') return HANDS;
  if (set === 'shell') return linux ? SHELL_LINUX : SHELL_ANDROID;
  return linux ? CHAT_LINUX : CHAT_ANDROID;
}

/** A roll: a dare other than [current] (while there is another), from [rand] (0 to 1, as Math.random). */
export function rollDare(count: number, current: number, rand: () => number): number {
  if (count <= 1) return 0;
  const n = Math.min(count - 2, Math.floor(rand() * (count - 1)));
  return n >= current ? n + 1 : n;
}

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** The die's face after [rolls] rolls (0 or more): a new face each roll, all six in turn. */
export function dieFace(rolls: number): string {
  return DIE[(rolls * 5 + 4) % DIE.length];
}
