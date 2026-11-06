// What phone and build this is: device facts from expo-device (loaded
// lazily: a build without it must still boot), falling back to React
// Native's Android constants, plus the locale and the build channel.
import { Platform } from 'react-native';
import type { Channel } from '../../../../tce/core/schema/wire.ts';
import { getBuildChannel } from '../runner';

type DeviceModule = typeof import('expo-device');

const CHANNELS: readonly Channel[] = ['full', 'lite', 'play'];

let deviceMod: DeviceModule | null | undefined;
function deviceModule(): DeviceModule | null {
  if (deviceMod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      deviceMod = require('expo-device') as DeviceModule;
    } catch {
      deviceMod = null;
    }
  }
  return deviceMod;
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function platformConstants(): Record<string, unknown> {
  try {
    return (Platform.constants ?? {}) as unknown as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Device facts from expo-device, falling back to React Native's Android
// constants when the module is missing.
export function deviceFacts() {
  const d = deviceModule();
  const pc = platformConstants();
  const version = Number(Platform.Version);
  return {
    manufacturer: text(d?.manufacturer) ?? text(pc.Manufacturer) ?? 'unknown',
    model: text(d?.modelName) ?? text(pc.Model) ?? 'unknown',
    designName: text(d?.designName) ?? '',
    productName: text(d?.productName) ?? '',
    fingerprint: text(d?.osBuildFingerprint) ?? text(pc.Fingerprint) ?? '',
    totalMemory: typeof d?.totalMemory === 'number' && d.totalMemory > 0 ? d.totalMemory : null,
    sdkInt: d?.platformApiLevel ?? (Number.isFinite(version) ? version : 0),
    abi: text(d?.supportedCpuArchitectures?.[0]) ?? 'unknown',
  };
}

export type DeviceFacts = ReturnType<typeof deviceFacts>;

export function locale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'und';
  } catch {
    return 'und';
  }
}

export function channel(): Channel {
  try {
    const c = getBuildChannel();
    return CHANNELS.includes(c as Channel) ? (c as Channel) : 'full';
  } catch {
    return 'full';
  }
}
