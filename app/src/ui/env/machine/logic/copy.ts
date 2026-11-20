// The machine page's own lines. Pure (zero RN imports):
// scripts/vectors/test_machine_page.js checks it.

/** Under the Controls deck, for the keys that type a command into a terminal. */
export function typedCommandNote(installTools: boolean, updateSystem: boolean): string | null {
  const keys = [installTools ? 'Install tools' : null, updateSystem ? 'Update system' : null].filter(Boolean);
  if (keys.length === 0) return null;
  const opens = keys.length === 1 ? 'opens' : 'open';
  return `${keys.join(' and ')} ${opens} a terminal with the command typed in; press Enter to run it.`;
}

export function insideFailedLine(reason: string): string {
  return `Couldn't look inside: ${reason}`;
}

/** An Android machine has no Linux of its own. */
export const ANDROID_MACHINE_NOTE =
  "This agent runs commands with Android's own shell: there's no Linux here to install packages into or reset.";

export const NOT_A_SANDBOX = "Not a security sandbox: what runs here can reach the network and this app's files.";

export const NO_SYSTEMD = "systemd doesn't run here, so start services by hand.";

/** A Linux machine whose env record is gone: a reset copies the env's base, so there is none. */
export const NO_RESET_NOTE = "Its system is gone, so this machine can't be reset.";
