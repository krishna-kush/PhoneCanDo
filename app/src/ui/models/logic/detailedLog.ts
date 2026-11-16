// A model's Detailed log switch on its Server log page, in words. Pure
// (zero RN imports).

export const DETAILED_LOG_TITLE = 'Detailed log';

/**
 * What the switch does: on, the server's next start logs what it does with each request's prompt (what it reuses,
 * what it reads again, and the text where a prompt first changes), so the log then holds prompt text. Either way,
 * changing it restarts the model.
 */
export function detailedLogNote(on: boolean): string {
  const what =
    "the model's server logs what it does with each prompt: what it reuses, what it reads again, and the text where a prompt first changes. The log then holds prompt text.";
  return `${on ? `On: ${what}` : `Off. On, ${what}`} Changing it restarts the model.`;
}
