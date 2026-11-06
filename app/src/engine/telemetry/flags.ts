// The adapter's mutable flags, shared by the modules that set them (boot,
// the screen actions) and those that read them (the send gate, the net port,
// the state view). No imports, so every module here may depend on it.

// Adapter-owned, debug builds only: '1' sends to the local dev host.
export const DEV_LOCAL_KEY = 'phonecando.telemetry.devLocal.v1';

export const flags = {
  /** startTelemetry finished (or failed): the UI may trust the other flags. */
  ready: false,
  // Nothing is sent until the first-launch notice was answered; an unreadable
  // answer counts as not given.
  noticeShown: false,
  /** Debug builds only: send to the local dev host. */
  devLocal: false,
};
