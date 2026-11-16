// What Settings → About prints: its spec plate's fields, the end credits,
// what A-01 says as it is booped, with a jackpot every tenth boop, and the
// postcard on the plate's back. Pure (zero RN imports).
import { boopLine } from '../../common/face/lines.ts';

export type Field = { term: string; value: string };

/** Every tenth boop is a jackpot: hearts and a stamp. */
export const JACKPOT_EVERY = 10;

const JACKPOTS = ['jackpot! best friends now', 'ten more? legend', 'boop champion, certified'];

export function isJackpot(boops: number): boolean {
  return boops > 0 && boops % JACKPOT_EVERY === 0;
}

/** What A-01 says after `boops` taps: an invite first, a jackpot line on each tenth, else the next boop line. */
export function boopCaption(boops: number): string {
  if (boops <= 0) return 'on duty · tap me';
  if (isJackpot(boops)) return JACKPOTS[Math.min(boops / JACKPOT_EVERY, JACKPOTS.length) - 1];
  return boopLine(boops - 1);
}

/** The spec plate, top to bottom. */
export function plateFields(version: string, versionCode: number, channel: string, boops: number): Field[] {
  return [
    { term: 'Model', value: 'On-device coding agents' },
    { term: 'Version', value: `v${version}` },
    { term: 'Build', value: String(versionCode) },
    { term: 'Channel', value: channel },
    { term: 'Lives on', value: 'this phone' },
    { term: 'Boops', value: String(boops) },
  ];
}

/** The end credits: a role and who played it. */
export const CREDITS: readonly { role: string; name: string }[] = [
  { role: 'Starring', name: 'A-01' },
  { role: 'Built-in agent', name: 'opencode' },
  { role: 'Linux', name: "PRoot, Termux's fork" },
  { role: 'Terminal', name: 'xterm.js' },
  { role: 'Local brains', name: 'llama.cpp' },
  { role: 'Type', name: 'Geist Mono' },
  { role: 'Built with', name: 'React Native, Expo, Tamagui' },
  { role: 'Filmed on location', name: 'your phone' },
];

/** Who made the app, in one place: the repo's public GitHub and git name. Never an email, phone or city. */
export const AUTHOR = {
  name: 'Krishna Kushwaha',
  handle: 'krishna-kush',
  github: 'https://github.com/krishna-kush',
} as const;

/**
 * The back of the spec plate, a postcard (postcard/): the note, who signs
 * it, and the address on its right, a line on each rule.
 */
export const POSTCARD = {
  lines: ['I built this so your phone could do the work while you go live a little.', 'Thanks for taking it for a spin.'],
  signoff: '— Krishna',
  address: ['To: The Curious One', 'Out living a little', "Your phone's got this"],
};
