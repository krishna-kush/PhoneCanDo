// State and actions for the accessibility setup guide (guide.ts holds the
// flow switch, steps and copy). Progress is self-tracked: Android never lets
// the app read its restricted-settings lock, so only the switch turning on is
// observable.
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as runner from '../../engine/runner';
import { trackOnce } from '../../engine/telemetry';
import { useAppStore } from '../../state/app';
import { A11Y_STEPS, type A11yStep, COPY, RESTRICTED_FLOW, stepCopy, stepFixes } from './guide';

// The lock arrived in Android 13 (API 33); older versions never refuse the
// switch, so the guide and its "Restricted setting" link stay hidden there.
const LOCK_OS = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export type AccessibilitySteps = ReturnType<typeof useAccessibilitySteps>;

export function useAccessibilitySteps() {
  const step = useAppStore((s) => s.a11yStep);
  const setStep = useAppStore((s) => s.setA11yStep);
  const forced = useAppStore((s) => s.a11yGuideForced);
  const setForced = useAppStore((s) => s.setA11yGuideForced);
  // Read at creation so the first render already reflects the switch.
  const [connected, setConnected] = useState(() => runner.isUiAutomationConnected());
  const [enabled, setEnabled] = useState(
    () => runner.isUiAutomationConnected() || runner.isAccessibilityServiceEnabled(),
  );
  const [ranBefore, setRanBefore] = useState(() => runner.hasAccessibilityConnectedBefore());
  const [note, setNote] = useState(() => runner.canShowRestrictedSettingNote());
  // Set when a step's button opened an Android screen; the next return to
  // the app without the switch on moves the guide on.
  const pendingAdvance = useRef(false);

  function refresh() {
    const on = runner.isUiAutomationConnected();
    const switchedOn = on || runner.isAccessibilityServiceEnabled();
    // Whether the guide was showing before this refresh (same rule as `guided`).
    const wasGuided = LOCK_OS && !enabled && (forced || (RESTRICTED_FLOW && !ranBefore));
    setConnected(on);
    setEnabled(switchedOn);
    setRanBefore(runner.hasAccessibilityConnectedBefore());
    setNote(runner.canShowRestrictedSettingNote());
    if (switchedOn) {
      // The switch turning on finishes whichever step the guide was on.
      if (wasGuided) trackOnce(`a11y.step.${step}.done`);
      pendingAdvance.current = false;
      if (step !== 1) void setStep(1);
      if (forced) setForced(false);
      return;
    }
    if (pendingAdvance.current) {
      pendingAdvance.current = false;
      if (step < 3) {
        trackOnce(`a11y.step.${step}.done`);
        void setStep((step + 1) as A11yStep);
      }
    }
  }

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, forced]);

  const guided = LOCK_OS && !enabled && (forced || (RESTRICTED_FLOW && !ranBefore));

  // Funnel: each guide step counts once per run, however often it renders
  // (this hook runs in Settings and in the agent's dialog at once).
  useEffect(() => {
    if (guided) trackOnce(`a11y.step.${step}.reached`);
  }, [guided, step]);

  function openAccessibility(advance: boolean): boolean {
    const ok = runner.openAccessibilitySettings() === 'opened';
    pendingAdvance.current = ok && advance;
    return ok;
  }

  // Opens the Android screen for the current step; false if Android refused.
  // The plain flow always goes to the Accessibility list.
  function open(): boolean {
    if (!guided) return openAccessibility(false);
    if (step === 1 && note) {
      if (runner.showRestrictedSettingNote() === 'opened') {
        // The note sits over the app; dismissing it lands on step 2.
        trackOnce('a11y.restricted_seen');
        trackOnce('a11y.step.1.done');
        pendingAdvance.current = false;
        void setStep(2);
        return true;
      }
      setNote(false);
      return openAccessibility(true);
    }
    if (step === 2) {
      const ok = runner.openAppInfoSettings() === 'opened';
      pendingAdvance.current = ok;
      return ok;
    }
    return openAccessibility(true);
  }

  function goTo(next: A11yStep) {
    // "Already did it, skip ahead": the user vouches the step is done.
    if (next > step) trackOnce(`a11y.step.${step}.done`);
    pendingAdvance.current = false;
    void setStep(next);
  }

  // The plain flow was showing and Android refused the switch: that refusal
  // was the note, so the guide starts at step 2.
  function forceGuide() {
    trackOnce('a11y.restricted_seen');
    pendingAdvance.current = false;
    setForced(true);
    void setStep(2);
  }

  // Step 1's other road, for when Android's note did not appear.
  const alt =
    guided && step === 1 && note
      ? {
          label: COPY.altStep1,
          run: () => {
            openAccessibility(true);
          },
        }
      : null;

  return {
    step,
    total: A11Y_STEPS,
    note,
    connected,
    enabled,
    guided,
    // The plain flow's way into the guide after Android refused the switch.
    canForce: LOCK_OS && !enabled && !guided,
    copy: stepCopy(step, note),
    fixes: stepFixes(step),
    alt,
    open,
    goTo,
    forceGuide,
  };
}
