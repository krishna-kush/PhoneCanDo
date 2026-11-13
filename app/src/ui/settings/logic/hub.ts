// The Settings hub's rows: each of Settings' pages with a playful line
// that also says what is inside, and a short line of how it is set now.
// Account (optional Google sign-in) comes first, Tell a friend (sharing
// and what the links did) near the end. Phone control is not a row: it
// sits on Settings itself, above them. Pure (zero RN imports).
import type { RunLimits } from '../../../engine/runLimits';
import type { SettingsPageId } from '../../../state/app/routes';
import * as account from '../../account/copy.ts';
import * as refer from '../../recommend/copy.ts';
import { capsLine } from './caps.ts';

export type HubFacts = {
  /** full, lite or play. */
  channel: string;
  themeMode: 'system' | 'light' | 'dark';
  extraKeysSticky: boolean;
  limits: RunLimits;
  /** Usage stats on or off; null while unknown or not in this build. */
  telemetry: boolean | null;
  version: string;
  /** Who is signed in; `offered` when this phone and build can sign in at all. */
  account: { signedIn: boolean; email: string | null; offered: boolean };
  /** Links shared from this phone (and the account). */
  sharesSent: number;
};

export type HubRow = {
  /** The page it opens: one of Settings' own, or About. */
  target: SettingsPageId | 'about';
  title: string;
  /** Playful, and says what is inside. */
  line: string;
  /** How it is set now. */
  now: string;
};

export function hubRows(f: HubFacts): HubRow[] {
  return [
    { target: 'account', title: account.ROW_TITLE, line: account.ROW_LINE, now: account.rowNow(f.account) },
    {
      target: 'look',
      title: 'Look & feel',
      line: "Lights on, lights off, and the terminal's extra keys",
      now: `${f.themeMode} theme · keys ${f.extraKeysSticky ? 'always up' : 'with the keyboard'}`,
    },
    {
      target: 'agents',
      title: 'Agents & models',
      line: 'Crowd control: how many run at once, and the RAM guard',
      now: capsLine(f.limits),
    },
    {
      target: 'privacy',
      title: 'Privacy',
      line: 'What we count, what we never touch, and your delete button',
      now: f.telemetry == null ? 'usage stats' : `usage stats ${f.telemetry ? 'on' : 'off'}`,
    },
    { target: 'updates', title: 'Updates', line: updatesLine(f.channel), now: `v${f.version} · ${f.channel}` },
    { target: 'refer', title: refer.ROW_TITLE, line: refer.ROW_LINE, now: refer.rowNow(f.sharesSent) },
    { target: 'about', title: 'About', line: 'Version, licences, and a mascot that likes boops', now: `v${f.version}` },
  ];
}

function updatesLine(channel: string): string {
  if (channel === 'lite') return 'Starter build: trade up to the one with eyes and hands';
  if (channel === 'play') return 'Play keeps us fresh: nothing to do here';
  return 'Fresh builds from GitHub, checked at every launch';
}

const ORDER: readonly SettingsPageId[] = ['account', 'look', 'agents', 'privacy', 'updates', 'refer'];

/** A page's kicker, numbered as its row on the hub: "settings · 02". */
export function pageKicker(id: SettingsPageId): string {
  return `settings · ${String(ORDER.indexOf(id) + 1).padStart(2, '0')}`;
}
