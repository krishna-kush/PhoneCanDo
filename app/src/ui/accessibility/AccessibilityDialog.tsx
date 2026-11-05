import { useEffect, useState } from 'react';
import { AppState, Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as runner from '../../engine/runner';
import AppButton from '../common/AppButton';
import { useTheme } from '../common/globals';
import { COPY } from './guide';
import StepLinks from './StepLinks';
import StepList from './StepList';
import { useAccessibilitySteps } from './useAccessibilitySteps';

// The agent asks the bridge for accessibility; this dialog sits over the
// chat while the bridge waits for PhoneCanDo's service to connect, so the
// agent carries on by itself once the switch is on. Only the user can flip
// the Android switch. During the guide the dialog stays open between trips;
// it closes itself once the service connects, and "Not now" tells the bridge
// to stop waiting.
export default function AccessibilityDialog() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const steps = useAccessibilitySteps();

  useEffect(() => {
    const check = () => {
      if (runner.consumeAccessibilityRequest()) {
        setMsg('');
        setOpen(true);
      }
      if (runner.isUiAutomationConnected()) setOpen(false);
    };
    const sub = runner.onAccessibilityRequest(() => {
      runner.consumeAccessibilityRequest();
      setMsg('');
      setOpen(true);
    });
    check();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      sub.remove();
      appState.remove();
    };
  }, []);

  // The service can bind a moment after the user is back in the app; close
  // as soon as it does instead of waiting for the next resume.
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      if (runner.isUiAutomationConnected()) setOpen(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  // Tells the bridge the user is on it (it keeps waiting for the service).
  // The dialog stays open in both flows, so "Not now" is still there if the
  // user comes back without the switch on; it closes itself on connect.
  function openStep() {
    const step = steps.step;
    const ok = steps.open();
    if (!ok) {
      setMsg(
        steps.guided && step === 2
          ? 'Could not open App info. Open Android Settings → Apps → PhoneCanDo manually.'
          : 'Could not open Android settings. Open Settings → Accessibility manually.',
      );
      return;
    }
    runner.resolveAccessibility(true, steps.guided);
    setMsg('');
  }

  function runAlt() {
    steps.alt?.run();
    runner.resolveAccessibility(true, true);
    setMsg('');
  }

  // "Not now": the bridge stops waiting and the agent hears it at once.
  function close() {
    runner.resolveAccessibility(false, false);
    setMsg('');
    setOpen(false);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="$5"
      >
        <YStack
          backgroundColor={t.panel}
          borderWidth={1}
          borderColor={t.lineStrong}
          borderRadius={0}
          padding="$4"
          gap="$3"
          width="100%"
          maxWidth={360}
        >
          <Text fontSize={19} fontWeight="700">
            {steps.guided
              ? `Unlock phone control · step ${steps.step} of ${steps.total}`
              : 'Accessibility permission'}
          </Text>
          <Text fontSize={15} color="$color10">
            {COPY.dialogNeed}
            {steps.guided ? COPY.dialogGuided : COPY.dialogPlain}
          </Text>
          {steps.guided ? <StepList step={steps.step} note={steps.note} /> : null}
          <Text fontSize={13} color="$color10">
            {COPY.dialogOnlyYou}
          </Text>
          {msg ? (
            <Text fontSize={13} color="$color10">
              {msg}
            </Text>
          ) : null}
          <XStack gap="$2" marginTop="$2">
            <AppButton variant="secondary" flex={1} onPress={close}>
              Not now
            </AppButton>
            <AppButton flex={1} onPress={openStep}>
              {steps.guided ? steps.copy.button : 'Open settings'}
            </AppButton>
          </XStack>
          <StepLinks
            links={[
              ...(steps.alt ? [{ label: steps.alt.label, onPress: runAlt }] : []),
              ...(steps.guided
                ? steps.fixes.map((fix) => ({ label: fix.label, onPress: () => steps.goTo(fix.to) }))
                : []),
              ...(steps.canForce ? [{ label: COPY.forceGuide, onPress: steps.forceGuide }] : []),
            ]}
          />
        </YStack>
      </YStack>
    </Modal>
  );
}
