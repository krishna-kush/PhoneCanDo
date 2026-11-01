// Shared mobile-first metrics. Every tappable control in the app should
// meet the 48dp minimum (AGENTS: no per-device numbers — these are
// platform accessibility constants, not device measurements).
export const HIT = {
  minTouch: 48,
  buttonH: 52,
  inputH: 52,
  headerH: 60,
  tabH: 56,
  fabSize: 64,
} as const;
