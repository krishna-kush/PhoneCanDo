// A new custom agent kind's id: `user.` and its name as lowercase letters,
// digits and dashes (the kit's id pattern), numbered when the user already
// has one by that name. An edit keeps the id it has, so agents of the kind
// keep finding it. Pure (zero RN imports).

export const USER_ID_PREFIX = 'user.';

// The kit's id is at most 64 characters; room is left for "-99".
const MAX_SLUG = 56;

function slugOf(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '');
  if (slug === '') return 'agent';
  return /^[a-z]/.test(slug) ? slug : `agent-${slug}`.slice(0, MAX_SLUG).replace(/-+$/, '');
}

/** `user.<slug>`, or `user.<slug>-2` and on when [taken] has it. */
export function userKindId(name: string, taken: readonly string[]): string {
  const base = USER_ID_PREFIX + slugOf(name);
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!taken.includes(id)) return id;
  }
}
