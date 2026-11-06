// The one tce client and where it sends: release builds to TELEMETRY_BASE,
// debug builds to the local dev host (`pnpm -C tce dev` + `adb reverse
// tcp:8787 tcp:8787`). Created on first use from the ports; null when this
// build lacks expo-crypto (usage stats stay off) or setup failed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type AdapterClient } from '../../../../tce/client/index.ts';
import { cryptoModule } from './crypto';
import { log } from './log';
import { envPort, netPort } from './ports';

/**
 * The one production endpoint: the tce Worker's API host (paths /v1/*). Kept
 * apart from the site's domain so the backend can move without an app update.
 */
export const TELEMETRY_BASE = 'https://api.phonecando.app';
/** What is collected and why, in plain words: a page on the website. */
export const PRIVACY_URL = 'https://phonecando.app/privacy/';

const DEV_LOCAL_BASE = 'http://127.0.0.1:8787';
const NET_TIMEOUT_MS = 10_000;

let client: AdapterClient | null | undefined;

/** The client, created on the first call. Null when this build cannot have one. */
export function getClient(): AdapterClient | null {
  if (client !== undefined) return client;
  const c = cryptoModule();
  if (!c) {
    log.warn('expo-crypto is not in this build; usage stats stay off');
    client = null;
    return null;
  }
  try {
    client = createClient({
      baseUrl: __DEV__ ? DEV_LOCAL_BASE : TELEMETRY_BASE,
      storage: AsyncStorage,
      net: netPort,
      env: envPort,
      clock: { now: () => Date.now() },
      ids: { uuid: () => c.randomUUID() },
      log,
      timeoutMs: NET_TIMEOUT_MS,
    });
  } catch (e) {
    log.error('client setup failed', { error: e instanceof Error ? e.message : String(e) });
    client = null;
  }
  return client;
}

/** The client if getClient() already made one; never creates it. */
export function currentClient(): AdapterClient | null {
  return client ?? null;
}
