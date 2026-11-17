// The Schedules page's alarm clock (clock/AlarmClock.tsx): where its hands
// point at a moment, in the phone's own zone. Pure (zero RN imports).

/** The hands at [now], in degrees clockwise from 12; each moves on with the hand below it, as a real clock's do. */
export function handAngles(now: number): { hour: number; minute: number; second: number } {
  const t = new Date(now);
  const s = t.getSeconds();
  const m = t.getMinutes() + s / 60;
  return { hour: ((t.getHours() % 12) + m / 60) * 30, minute: m * 6, second: s * 6 };
}
