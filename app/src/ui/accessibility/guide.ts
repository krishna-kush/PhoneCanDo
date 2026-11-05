// The accessibility setup guide: the flow switch, the steps and every
// user-facing line, in one place. Pure (no React Native imports), so copy
// edits and flow changes stay in this file.
//
// Android never lets an app read its restricted-settings lock
// (research/restricted-settings.md), so RESTRICTED_FLOW decides the setup
// flow instead of a reading:
//   true:  a three-step guide. 1: Android's "Restricted setting" note, shown
//          in place on Android 14+ (RestrictedSettings.kt), otherwise by
//          tapping PhoneCanDo in Accessibility; that note is what adds the
//          App info item. 2: App info → Allow restricted settings. 3: the
//          switch. Release builds reach users as files (lite from the site,
//          full through lite's in-place update), and Android locks every
//          such install.
//   false: straight to the switch, with the guide one tap away ("Android
//          said Restricted setting? Show the steps").
// Either way the guide ends once the switch is on, and it is skipped after
// the service has run on this install, which proves the switch was allowed.
export const RESTRICTED_FLOW = true;

export type A11yStep = 1 | 2 | 3;
export const A11Y_STEPS = 3;

export type StepCopy = { title: string; body: string; button: string };
export type StepFix = { label: string; to: A11yStep };

// `note`: the app can show Android's note itself (Android 14+, the OEM kept
// that screen open); otherwise step 1 goes through the Accessibility list.
export function stepCopy(step: A11yStep, note: boolean): StepCopy {
  if (step === 1) {
    return note
      ? {
          title: "Knock on Android's door",
          body: 'Android answers with a "Restricted setting" note. That is its safety check, all good: tap OK.',
          button: "1 · Show Android's check",
        }
      : {
          title: "Knock on Android's door",
          body: 'In Accessibility, tap PhoneCanDo. Android answers with a "Restricted setting" note. That is its safety check, all good: tap OK and come back.',
          button: '1 · Open accessibility',
        };
  }
  if (step === 2) {
    return {
      title: 'Vouch for PhoneCanDo',
      body: 'In App info, tap ⋮ (top right) → Allow restricted settings, and confirm. Then come back.',
      button: '2 · Open app info',
    };
  }
  return {
    title: 'Flip the switch',
    body: 'Tap PhoneCanDo and turn it on. That is it!',
    button: '3 · Open accessibility',
  };
}

// One-tap corrections: the app cannot see whether a step worked, so the user
// says so.
export function stepFixes(step: A11yStep): StepFix[] {
  if (step === 1) return [{ label: 'Already saw that note? Skip to step 2', to: 2 }];
  if (step === 2) {
    return [
      { label: 'No such option under ⋮? Back to step 1', to: 1 },
      { label: 'Already allowed it? Skip to step 3', to: 3 },
    ];
  }
  return [{ label: 'Still says restricted? Back to step 2', to: 2 }];
}

// Settings → Phone control and the agent's dialog. The Accessibility lines
// step aside once the switch is on.
export const COPY = {
  // What the section is for, while the Accessibility switch is off.
  why:
    "Phone control gives the agent eyes and hands: it reads your screen and taps, types and scrolls for you, like a friend helping over your shoulder. Android's Accessibility switch makes that possible, and you set it up once.",
  // Under the Accessibility card while the guide runs.
  restrictedNote:
    'Android keeps this switch extra safe for apps from outside the Play Store. Three quick steps open it, and you only do this once.',
  plainHint: 'Android Settings → Accessibility → PhoneCanDo',
  // Once the switch is on, this one line replaces the Accessibility lines.
  onHint: 'Eyes and hands are ready. Turn it off anytime in Android Settings → Accessibility.',
  api: "Uses Android's Accessibility API to read the screen and tap, type, scroll, notify, and use the clipboard. Off by default; the agent cannot unlock it.",
  altStep1: "Didn't see the note? Tap PhoneCanDo in Accessibility instead",
  forceGuide: 'Android said "Restricted setting"? Show the steps',
  // The agent's request dialog.
  dialogNeed: "PhoneCanDo needs Android's Accessibility service to read the screen and act.",
  dialogGuided:
    ' Android adds a safety lock for apps from outside the Play Store; three quick steps open it. Each button opens the right screen.',
  dialogPlain: ' Open Android Accessibility settings and switch PhoneCanDo on.',
  dialogOnlyYou: 'The AI cannot do this; only you can. It carries on by itself once the switch is on.',
} as const;
