// What a machine's inspection tag shows of it at a glance: what it is, its
// CPU, its age, its state and its space beside the phone's free space, and
// the tag's checks. Pure (zero RN imports):
// scripts/vectors/test_machine_page.js checks it.
import type { Env, Image } from '../../../../engine/linux/types';
import { formatAgo, formatBytes } from '../../logic/format.ts';
import { osName } from '../../logic/titles.ts';
import { cpuLine, type Inside } from './inside.ts';
import type { MachineTool } from './machineTools.ts';

export type Glance = {
  /** "Debian GNU/Linux 12"; "Android's own shell" without Linux; "Linux" before its OS is known. */
  os: string;
  /** "aarch64 · 8 cores"; null before the look inside. */
  cpu: string | null;
  /** "3 days ago". */
  made: string | null;
  /** "Ready", "Setting up"… */
  state: string;
  ready: boolean;
  failed: boolean;
  /** Its size in bytes; null when not measured yet. */
  size: number | null;
  /** The phone's free bytes; null when Android won't say. */
  free: number | null;
};

export type GlanceInput = {
  image: Pick<Image, 'state' | 'os' | 'sizeBytes' | 'createdAt'>;
  env: Pick<Env, 'os'> | null;
  linux: boolean;
  inside: Pick<Inside, 'arch' | 'cpus'> | null;
  phoneFree: number | null;
  now: number;
};

const STATE_WORDS: Record<Image['state'], string> = {
  ready: 'Ready',
  creating: 'Setting up',
  resetting: 'Resetting',
  deleting: 'Deleting',
  failed: 'Setup stopped',
};

/** Below this much free space on the phone, the space check fails. */
export const LOW_FREE_BYTES = 1_000_000_000;

export function machineGlance({ image, env, linux, inside, phoneFree, now }: GlanceInput): Glance {
  const os = image.os ?? env?.os ?? null;
  return {
    os: !linux ? "Android's own shell" : os ? osName(os) : 'Linux',
    cpu: inside ? cpuLine(inside) : null,
    made: formatAgo(image.createdAt, now) || null,
    state: STATE_WORDS[image.state],
    ready: image.state === 'ready',
    failed: image.state === 'failed',
    size: image.sizeBytes > 0 ? image.sizeBytes : null,
    free: phoneFree,
  };
}

/** "1.2 GB here · 12.3 GB free on the phone". */
export function spaceLine(size: number | null, free: number | null): string {
  const here = size == null ? 'not measured yet' : `${formatBytes(size)} here`;
  return free == null ? here : `${here} · ${formatBytes(free)} free on the phone`;
}

/** "Debian GNU/Linux 12 · aarch64 · 8 cores · made 3 days ago". */
export function glanceLine(g: Glance): string {
  return [g.os, g.cpu, g.made ? `made ${g.made}` : null].filter(Boolean).join(' · ');
}

/** The tools that are here, with their versions: "Git 2.39, Python 3.11, Make". */
export function toolsHereLine(tools: readonly MachineTool[]): string | null {
  const here = tools.filter((t) => t.state === 'here');
  return here.length ? here.map((t) => (t.version ? `${t.name} ${t.version}` : t.name)).join(', ') : null;
}

/** One line of the inspection tag: passed, failed, or not known yet; `install` when a tap types the install line. */
export type Check = { label: string; ok: boolean | null; install?: boolean };

/**
 * The inspection tag's checks, in order: its state, what its agents need
 * (`who`: one kind's name, null for several kinds; a Linux machine with
 * needs only), its space, and the tools that are here (Linux only).
 * `canInstall`: a failed needs check types the install line on a tap.
 */
export function inspectionChecks(
  g: Glance,
  tools: readonly MachineTool[],
  who: string | null,
  linux: boolean,
  canInstall: boolean,
): Check[] {
  const checks: Check[] = [{ label: g.state, ok: g.ready ? true : g.failed ? false : null }];
  const needed = tools.filter((t) => t.needed);
  if (linux && needed.length > 0) {
    const missing = needed.filter((t) => t.state === 'missing').map((t) => t.name);
    if (needed.some((t) => t.state === 'unknown')) {
      checks.push({ label: who ? `Checking what ${who} needs` : 'Checking what its agents need', ok: null });
    } else if (missing.length === 0) {
      checks.push({ label: who ? `Has what ${who} needs` : 'Has what its agents need', ok: true });
    } else {
      const label = who ? `${who} needs ${missing.join(', ')}` : `Its agents need ${missing.join(', ')}`;
      checks.push({ label, ok: false, install: canInstall });
    }
  }
  if (g.size == null || g.free == null) checks.push({ label: `Space: ${spaceLine(g.size, g.free)}`, ok: null });
  else if (g.free < LOW_FREE_BYTES) checks.push({ label: `Space: the phone is nearly full, ${formatBytes(g.free)} free`, ok: false });
  else checks.push({ label: `Space: ${formatBytes(g.size)} here, ${formatBytes(g.free)} free`, ok: true });
  if (linux) {
    const here = toolsHereLine(tools);
    const read = tools.some((t) => t.state === 'here' || t.state === 'absent');
    checks.push(here ? { label: `Tools: ${here}`, ok: true } : { label: read ? 'Tools: none of the common ones' : 'Tools: looking inside…', ok: null });
  }
  return checks;
}

/** The inspection stamp's time: "10:42", by the phone's clock. */
export function clockOf(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
