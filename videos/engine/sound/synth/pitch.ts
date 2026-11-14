// Notes as MIDI numbers (A4 = 69), and semitones as frequency ratios.

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export const ratio = (semitones: number) => 2 ** (semitones / 12);
