import { NativeModule, requireNativeModule } from 'expo';

import type { LinuxStatus } from './PhoneCanDoLinux.types';

export type { LinuxStatus } from './PhoneCanDoLinux.types';

type LinuxEvents = {
  phonecandoLinuxProgress(e: Record<string, unknown>): void;
  phonecandoLinuxChanged(e: Record<string, never>): void;
};

// Only loads the module. Its typed surface (envs, images, jobs, the Docker
// Hub catalog) is declared in the engine seam app/src/engine/linux/native.ts,
// next to the JS contract types (app/src/engine/linux/types.ts) the native
// maps follow.
declare class PhoneCanDoLinuxModule extends NativeModule<LinuxEvents> {
  linuxStatus(): LinuxStatus;
}

const mod = requireNativeModule<PhoneCanDoLinuxModule>('PhoneCanDoLinux');

export function linuxStatus(): LinuxStatus {
  return mod.linuxStatus();
}

export default mod;
