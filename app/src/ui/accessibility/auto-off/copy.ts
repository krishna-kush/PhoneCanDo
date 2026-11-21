// Auto off in words (engine/autoOff.ts has why it exists): A-01 clocks out
// by itself, so payment and bank apps open. The Settings box in A-01's
// voice (its head line, what the switch means, a quip at each flip), A-01's
// time card the box draws, and the lines that say Auto off was what turned
// it off.
// Pure (zero RN imports).

/** The Settings box's strip; also what a screen reader calls its switch. */
export const BOX_TITLE = 'Auto off';

/** A-01's head line in the box: its worry while off, its answer once on. */
export function boxTitle(on: boolean): string {
  return on ? 'I clock out by myself' : OFF_TITLE;
}

/** The box's head line while Auto off is off. */
export const OFF_TITLE = 'Bank apps are shy';

/** Under the head line, until a flip gives A-01 something to say. */
export const BOX_CAPTION = 'A-01 · auto off';

/**
 * When Auto off clocks out, as native times it (runner autooff/AutoOffRules.kt:
 * QUIET_MS, WARM_UP_MS; test_phone_control.js holds them in step): this long
 * after you leave PhoneCanDo with no agent needing the phone, and never this
 * soon after the switch comes on.
 */
export const QUIET_SECONDS = 10;
export const WARM_UP_MINUTES = 2;

/** What the switch means now, in A-01's voice, with when it clocks out. */
export function boxBody(on: boolean): string {
  return on
    ? `I clock out ${QUIET_SECONDS} seconds after you leave PhoneCanDo, once no agent needs the phone, so payment and bank apps open. Never in my first ${WARM_UP_MINUTES} minutes after you switch me on.`
    : `Payment and bank apps won't open while I'm on. Tap here and I'll clock out ${QUIET_SECONDS} seconds after you leave PhoneCanDo, whenever no agent needs the phone.`;
}

const CLOCK_OUT_LINES = ["clocking out when you're done", 'bank apps can come out now', "i'll slip out quietly"] as const;
const ON_DUTY_LINES = ['back on duty', 'staying put', 'night shift it is'] as const;

/** A-01's quip for the [n]th flip (from 1), in place of the caption. */
export function flipLine(on: boolean, n: number): string {
  const lines = on ? CLOCK_OUT_LINES : ON_DUTY_LINES;
  return lines[(Math.max(n, 1) - 1) % lines.length];
}

/** What Auto off costs, on the box while it is on. */
export const CATCH =
  'The catch: each time an agent needs the phone after that, you switch Accessibility back on. One switch, no steps.';

/** Saving the switch failed: the build is older than Auto off, or the save did not stick. */
export const SAVE_FAILED = "Couldn't save Auto off. Try again, or update PhoneCanDo.";

/** The time card's head and serial. */
export const CARD_TITLE = 'Time card · A-01';
export const CARD_NO = 'No. 0001';

export type CardLine = { punch: 'IN' | 'OUT'; when: string };

/** When A-01 punches in and out. */
export function cardLines(on: boolean): readonly CardLine[] {
  return [
    { punch: 'IN', when: 'you switch Accessibility on' },
    {
      punch: 'OUT',
      when: on
        ? `${QUIET_SECONDS} s after you leave PhoneCanDo, if no agent needs the phone`
        : 'only when you switch it off',
    },
  ];
}

/** The stamp across the card. */
export function cardStamp(on: boolean): string {
  return on ? 'auto' : 'by hand';
}

// Once Auto off has turned the service off, until it runs again.
export const CLOCKED_OUT_STAMP = 'clocked out';
export const CLOCKED_OUT_LINE = 'clocked out · Auto off · back when you switch me on';

/** On an agent's Accessibility slip. */
export const DIALOG_LINE =
  'Auto off clocked phone control out while nobody needed it. Switch it back on; it clocks out again once the agent is done and you leave PhoneCanDo.';
