// Settings that follow a signed-in person to every phone: theme, extra keys,
// the lite update offer and the run caps (state/logic/settingsSync/keys.ts).
// A change is stamped with its time whether signed in or not, and sent a
// moment later; a sync sends every synced setting with its stamp and takes
// back each one the account holds from a later change (logic/settingsSync/
// merge.ts). Syncs run after sign-in, when the app comes to the front and
// after a change. Signed out, nothing leaves the phone.
import { signedIn, syncAccountSettings } from '../../engine/account';
import { runLimits, setRunLimits, type RunLimits } from '../../engine/runLimits';
import { useAccountStore } from '../account';
import { useAppStore } from '../app';
import { CAP_KEYS, PREF_KEYS, type SyncedKey, type SyncedSettings } from '../logic/settingsSync/keys';
import { incoming, outgoing, type Incoming } from '../logic/settingsSync/merge';
import { useSettingsSyncStore } from '../settingsSync';

/** A change goes out this long after the last one (a run of taps sends once). */
const SEND_AFTER_MS = 1500;

/** The synced settings as this phone holds them now. */
function readLocal(): SyncedSettings {
  const app = useAppStore.getState();
  const caps = runLimits();
  return {
    themeMode: app.themeMode,
    extraKeysSticky: app.extraKeysSticky,
    updatePromptMuted: app.updatePromptMuted,
    maxAgents: caps.maxAgents,
    maxModels: caps.maxModels,
  };
}

// True while the account's values are being applied, so they are not
// stamped as this phone's own changes.
let applying = false;

/** Applies the account's newer settings; stamps each one that took with the account's time. */
async function apply(list: Incoming[]): Promise<void> {
  if (list.length === 0) return;
  const took: Incoming[] = [];
  applying = true;
  try {
    const app = useAppStore.getState();
    const caps: RunLimits = { ...runLimits() };
    const capsIn: Incoming[] = [];
    for (const s of list) {
      if (s.key === 'themeMode') await app.setThemeMode(s.value);
      else if (s.key === 'extraKeysSticky') await app.setExtraKeysSticky(s.value);
      else if (s.key === 'updatePromptMuted') await app.setUpdatePromptMuted(s.value);
      else {
        caps[s.key] = s.value;
        capsIn.push(s);
        continue;
      }
      took.push(s);
    }
    // A build that cannot keep caps leaves them unstamped, so it never claims them.
    if (capsIn.length > 0 && setRunLimits(caps) != null) took.push(...capsIn);
  } finally {
    applying = false;
  }
  for (const s of took) useSettingsSyncStore.getState().stamp([s.key], s.at);
}

let running: Promise<void> | null = null;
let again = false;

/** Sends this phone's settings and takes the account's newer ones. No-op while signed out. */
export function syncSettingsWithAccount(): Promise<void> {
  if (running) {
    // A change during a sync goes out in one more round.
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        if (!signedIn()) return;
        await useSettingsSyncStore.getState().hydrate();
        const r = await syncAccountSettings(outgoing(readLocal(), useSettingsSyncStore.getState().stamps));
        if (!r.ok) {
          if (r.error === 'signed_out') useAccountStore.getState().hydrate();
          return;
        }
        await apply(incoming(r.value, useSettingsSyncStore.getState().stamps));
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

let sendTimer: ReturnType<typeof setTimeout> | null = null;

/** The user changed `keys` here: stamp them now and send them shortly. */
export function noteSettingsChanged(keys: readonly SyncedKey[]): void {
  if (applying || keys.length === 0) return;
  useSettingsSyncStore.getState().stamp(keys, Date.now());
  if (sendTimer) clearTimeout(sendTimer);
  sendTimer = setTimeout(() => {
    sendTimer = null;
    void syncSettingsWithAccount();
  }, SEND_AFTER_MS);
}

/** The run caps went from `before` to `after` (Settings → Agents & models). */
export function noteCapsChanged(before: RunLimits, after: RunLimits): void {
  noteSettingsChanged(CAP_KEYS.filter((k) => before[k] !== after[k]));
}

/** Notices the user changing a synced pref (theme, extra keys, update offer); returns the stop. */
export function watchSettingChanges(): () => void {
  return useAppStore.subscribe((now, before) => {
    // The stored values arriving at launch are not changes.
    if (!before.hydrated) return;
    noteSettingsChanged(PREF_KEYS.filter((k) => now[k] !== before[k]));
  });
}
