import { registerWebModule, NativeModule } from 'expo';

import type { TelemetryNativeSnapshot } from './telemetry.types';

export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';

// PhoneCanDoRunnerModule is not available on the web platform.
class PhoneCanDoRunnerModule extends NativeModule<{}> {}

// No native counters on the web.
export function getTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  return null;
}

export function consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  return null;
}

export function setTelemetryEnabled(_enabled: boolean): void {}

export default registerWebModule(PhoneCanDoRunnerModule, 'PhoneCanDoRunnerModule');
