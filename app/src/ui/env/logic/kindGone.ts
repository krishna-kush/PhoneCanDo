// What an agent says when its kind is no longer in this build (an older
// build made it, and we dropped the kind since): Home and its page say the
// same. Pure.

/** Why it can't start, and what stays. */
export function kindGoneText(kindId: string): string {
  return (
    `${kindId} isn't in this version of PhoneCanDo, so this agent can't start. ` +
    'Its machine and files stay until you delete it: run it yourself in a terminal there, or add it back as a custom agent.'
  );
}
