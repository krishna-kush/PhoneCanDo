// The Refer page's numbers: the funnel over every link (Sent → Opened →
// Downloaded → Installed → Using it) and each link's own row. Pure (zero
// RN imports).
import type { LinkStats } from '../../../engine/share/wire.ts';
import type { ShareLink } from '../../../state/logic/share/list.ts';

export type Funnel = { sent: number; opened: number; downloaded: number; installed: number; using: number };

export type FunnelStep = { key: keyof Funnel; label: string; line: string; count: number };

/** Totals over every link; Sent counts untracked links too. */
export function funnel(links: readonly ShareLink[], stats: Readonly<Record<string, LinkStats>>): Funnel {
  const f: Funnel = { sent: links.length, opened: 0, downloaded: 0, installed: 0, using: 0 };
  for (const l of links) {
    const s = l.code ? stats[l.code] : undefined;
    if (!s) continue;
    f.opened += s.opened;
    f.downloaded += s.downloaded;
    f.installed += s.installed;
    f.using += s.using;
  }
  return f;
}

/** The funnel's steps, in order, each with what it counts. */
export function funnelSteps(f: Funnel): FunnelStep[] {
  return [
    { key: 'sent', label: 'Sent', line: 'links you shared', count: f.sent },
    { key: 'opened', label: 'Opened', line: 'times a friend opened one', count: f.opened },
    { key: 'downloaded', label: 'Downloaded', line: 'tapped Download on the site', count: f.downloaded },
    { key: 'installed', label: 'Installed', line: 'opened the app through your link', count: f.installed },
    { key: 'using', label: 'Using it', line: 'came back on another day', count: f.using },
  ];
}

/** A link's title: the app it went through. */
export function linkTitle(link: ShareLink): string {
  return link.app ? `Via ${link.app}` : 'Shared';
}

/** A link's counts in one line, or why there are none. */
export function linkLine(link: ShareLink, stats: LinkStats | undefined): string {
  if (!link.code) return 'Not tracked: usage stats were off';
  if (!stats) return 'Not counted yet';
  const parts: string[] = [];
  if (stats.opened > 0) parts.push(`${stats.opened} opened`);
  if (stats.downloaded > 0) parts.push(`${stats.downloaded} downloaded`);
  if (stats.installed > 0) parts.push(`${stats.installed} installed`);
  if (stats.using > 0) parts.push(`${stats.using} using it`);
  return parts.length > 0 ? parts.join(' · ') : 'No clicks yet';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** When a link went out, in the phone's time: today, yesterday, or a date (with the year when not this one). */
export function sentLabel(at: number, now: number): string {
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  const d = new Date(at);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? date : `${date} ${d.getFullYear()}`;
}
