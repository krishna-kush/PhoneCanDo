// The sample rate, and seconds as samples. Beats need a film's tempo, so
// they become samples on its clock (clock.ts).

export const SR = 48000;

/** Seconds, as a whole number of samples. */
export const samplesOf = (seconds: number) => Math.round(seconds * SR);
