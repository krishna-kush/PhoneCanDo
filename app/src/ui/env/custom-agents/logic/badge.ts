// What the crew badge over the custom agent pages shows (form/HireBadge.tsx)
// while the new agent takes shape: the three things it needs, ticked off
// as they are filled in, a line each for how it installs, how it starts and
// the phone tools, its face's mood, the id its mascot is picked by, and the
// steps strip over the pages. Pure (zero RN imports).
import type { UserAgentForm } from '../../../../engine/agents/user/form.ts';
import { userKindId } from '../../../../engine/agents/user/ids.ts';
import { isPreset } from '../../../../engine/agents/user/install.ts';
import type { KindReview } from '../../../../engine/agents/user/review.ts';
import { INSTALL_CHOICES } from '../../logic/customAgentText.ts';

export type BadgeNeed = { label: string; done: boolean };
export type BadgeLine = { term: string; value: string };
export type BadgeMood = 'asleep' | 'busy' | 'awake' | 'oops' | 'happy';
/** A new kind, a saved one being edited, or one being imported. */
export type BadgeMode = 'new' | 'edit' | 'import';

/** The steps over the form and over the import, in order. */
export const FORM_STEPS = ['Fill in', 'Review'] as const;
export const IMPORT_STEPS = ['Paste', 'Review'] as const;

type Needed = Pick<UserAgentForm, 'name' | 'install' | 'installPackage' | 'script' | 'command'>;

/** The three things a kind needs, in the form's order, each ticked once it is in. */
export function badgeNeeds(f: Needed): BadgeNeed[] {
  const installs = isPreset(f.install) ? f.installPackage.trim() !== '' : f.install === 'script' ? f.script.trim() !== '' : true;
  return [
    { label: 'Name', done: f.name.trim() !== '' },
    { label: 'Install', done: installs },
    { label: 'Command', done: f.command.trim() !== '' },
  ];
}

/** "2 of 3", or "all in" once every need is ticked. */
export function needsCount(needs: readonly BadgeNeed[]): string {
  const done = needs.filter((n) => n.done).length;
  return done === needs.length ? 'all in' : `${done} of ${needs.length}`;
}

/** Its face: asleep until something is in, looking about while it fills, awake once all is in; a problem standing frowns. */
export function badgeMood(needs: readonly BadgeNeed[], problems: number): BadgeMood {
  if (problems > 0) return 'oops';
  const done = needs.filter((n) => n.done).length;
  if (done === 0) return 'asleep';
  return done === needs.length ? 'awake' : 'busy';
}

/** Its program: the command's first word, without its folder ("duck"). */
export function programOf(command: string): string {
  const first = command.trim().split(/\s+/)[0] ?? '';
  return first.split('/').pop() ?? '';
}

const tools = (on: boolean): string => (on ? 'phone tools on' : 'no phone tools');

/** The badge's lines while the form fills in. */
export function badgeLines(f: Needed & Pick<UserAgentForm, 'phoneTools'>): BadgeLine[] {
  const way = INSTALL_CHOICES[f.install].label;
  const pkg = isPreset(f.install) ? f.installPackage.trim() : '';
  const lines = f.install === 'script' ? f.script.split('\n').filter((l) => l.trim() !== '').length : 0;
  const installs = pkg ? `${way} · ${pkg}` : lines > 0 ? `${way} · ${lines} ${lines === 1 ? 'line' : 'lines'}` : way;
  return [
    { term: 'Installs', value: installs },
    { term: 'Starts', value: programOf(f.command) || '—' },
    { term: 'Tools', value: tools(f.phoneTools) },
  ];
}

/** The badge's lines on a review step, from what the kind runs. */
export function reviewBadgeLines(r: Pick<KindReview, 'installSteps' | 'packages' | 'runtimes' | 'command' | 'phoneTools'>): BadgeLine[] {
  const steps = r.installSteps.length;
  const installs =
    steps > 0 ? `${steps} ${steps === 1 ? 'step' : 'steps'}, as root` : r.packages.length + r.runtimes.length > 0 ? 'packages only' : 'nothing';
  return [
    { term: 'Installs', value: installs },
    { term: 'Starts', value: programOf(r.command) || '—' },
    { term: 'Tools', value: tools(r.phoneTools) },
  ];
}

/** The id its mascot is picked by: the one it is (or will be) saved under, so its face here is its face in the list. */
export function badgeId(kindId: string | null, name: string, taken: readonly string[]): string {
  return kindId ?? userKindId(name.trim() || 'agent', taken);
}

/** The badge's strip. */
export function badgeKicker(mode: BadgeMode): string {
  return mode === 'edit' ? 'Crew badge · on file' : mode === 'import' ? 'Crew badge · transfer' : 'Crew badge · new hire';
}

/** The stamp a review step lands on the badge. */
export function reviewStamp(mode: BadgeMode): string {
  return mode === 'edit' ? 'Ready to file' : 'Ready to hire';
}

/** A step's label on the strip: "01 Fill in", or "✓ Fill in" once it is behind. */
export function stepLabel(steps: readonly string[], i: number, at: number): string {
  return `${i < at ? '✓' : String(i + 1).padStart(2, '0')} ${steps[i]}`;
}

/** The strip as a screen reader says it: "Step 1 of 2, Fill in". */
export function stepSpoken(steps: readonly string[], at: number): string {
  return `Step ${at + 1} of ${steps.length}, ${steps[at]}`;
}
