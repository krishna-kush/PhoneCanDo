// The custom agent form's More settings: the expert fields folded under
// it, whether a problem is on one of them (so it opens), and how many are
// set (its closed row says so). Pure (zero RN imports):
// scripts/vectors/test_user_manifest.js.
import type { FormField, FormProblem } from '../../../../engine/agents/user/build.ts';
import { emptyForm, FORM_RUNTIMES, type UserAgentForm } from '../../../../engine/agents/user/form.ts';
import { presetRuntime } from '../../../../engine/agents/user/install.ts';

/** The expert fields, folded under More settings. */
export const MORE_FIELDS: readonly FormField[] = [
  'packages',
  'familyPackages',
  'needsNode',
  'needsPython',
  'versionCommand',
  'versionPattern',
  'bellWaits',
  'titlePattern',
  'messageEvent',
  'messageJson',
  'messageExit2',
];

/** Whether a problem is on a field in More settings, so it must open. */
export function moreHasProblem(problems: readonly FormProblem[]): boolean {
  return problems.some((p) => p.field != null && MORE_FIELDS.includes(p.field));
}

/**
 * How many of More settings' fields are not as a new form has them; a
 * runtime switch the package install hides (it brings the runtime) is not.
 */
export function moreSetCount(form: UserAgentForm): number {
  const empty = emptyForm();
  const hidden = FORM_RUNTIMES.find((r) => r.id === presetRuntime(form.install))?.flag;
  return MORE_FIELDS.filter((field) => {
    if (field === hidden) return false;
    const value = form[field];
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'boolean') return value !== empty[field];
    return Object.values(value).some((v) => v.trim() !== '');
  }).length;
}
