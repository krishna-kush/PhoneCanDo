// The SDK's environment and network ports: who this phone is (hashed ids,
// device facts, the app version and channel) and how a request is posted.
// Debug builds refuse to post unless the dev-only "Send to local dev host"
// switch is on. Storage is AsyncStorage, passed as is by client.ts.
import { getAndroidId, nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import type { EnvPort, NetPort } from '../../../../tce/client/types.ts';
import type { AppWire, DeviceWire } from '../../../../tce/core/schema/wire.ts';
import { getTelemetrySnapshot } from '../runner';
import { sha256Hex } from './crypto';
import { channel, deviceFacts, locale } from './device';
import { flags } from './flags';
import { deriveIds, withDrmId } from './identity';

export const envPort: EnvPort = {
  async identity() {
    const androidId = getAndroidId();
    if (!androidId) throw new Error('ANDROID_ID unavailable');
    const ids = await deriveIds(androidId, deviceFacts(), sha256Hex);
    // The Kotlin side hashes the Widevine id with HASH_PEPPER.drm; null while its flag is off.
    const drm = getTelemetrySnapshot()?.drmIdHash ?? null;
    return withDrmId(ids, drm);
  },

  async device(): Promise<Omit<DeviceWire, 'tester'>> {
    const f = deviceFacts();
    return {
      manufacturer: f.manufacturer,
      model: f.model,
      sdkInt: f.sdkInt,
      abi: f.abi,
      ramGb: f.totalMemory ? Math.round(f.totalMemory / 2 ** 30) : 0,
      locale: locale(),
      installSource: getTelemetrySnapshot()?.installSource ?? null,
    };
  },

  app(): AppWire {
    return {
      version: nativeApplicationVersion ?? '0.0.0',
      versionCode: Number.parseInt(nativeBuildVersion ?? '0', 10) || 0,
      channel: channel(),
    };
  },
};

export const netPort: NetPort = {
  async post(url, body, timeoutMs) {
    if (__DEV__ && !flags.devLocal) {
      throw new Error('debug build: sending is off (Settings → Privacy → Send to local dev host)');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: ctrl.signal,
      });
      const retryAfter = res.headers.get('Retry-After');
      return { status: res.status, text: await res.text(), retryAfter };
    } finally {
      clearTimeout(timer);
    }
  },
};
