import { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as runner from '../../engine/runner';
import AppButton from '../common/AppButton';
import { useTheme } from '../common/globals';
import { askerTitle, waitingLine } from '../common/promptQueue';
import { markAnswered, useBridgePrompts } from '../common/useBridgePrompts';
import { COPY } from './guide';
import StepLinks from './StepLinks';
import StepList from './StepList';
import { useAccessibilitySteps } from './useAccessibilitySteps';

// An agent asks the bridge for accessibility; this dialog sits over the
// chat while the bridge waits for PhoneCanDo's service to connect, so the
// agent carries on by itself once the switch is on. Only the user can flip
// the Android switch. It shows when the oldest waiting prompt is an
// accessibility request and reports to that request alone. During the guide
// it stays open between trips; it closes once the service connects (every
// waiting request then returns and its prompt is gone), and "Not now" tells
// this request's bridge call to stop waiting.
export default function AccessibilityDialog() {
  const t = useTheme();
  const { current, queue } = useBridgePrompts();
  const prompt = current?.kind === 'accessibility' ? current : null;
  const requestId = prompt?.requestId;
  const [msg, setMsg] = useState('');
  const steps = useAccessibilitySteps();

  useEffect(() => setMsg(''), [requestId]);

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
    if (requestId) runner.resolveAccessibility(requestId, true, steps.guided);
    setMsg('');
  }

  function runAlt() {
    steps.alt?.run();
    if (requestId) runner.resolveAccessibility(requestId, true, true);
    setMsg('');
  }

  // "Not now": this request's bridge call stops waiting and its agent hears
  // it at once; the next waiting prompt shows.
  function close() {
    if (!requestId) return;
    runner.resolveAccessibility(requestId, false, false);
    markAnswered([requestId]);
  }

  const waiting = waitingLine(queue.length - 1);

  return (
    <Modal visible={prompt !== null} transparent animationType="fade" onRequestClose={close}>
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
          {prompt ? (
            <Text fontSize={15} fontWeight="700">
              {askerTitle(prompt)}
            </Text>
          ) : null}
          <Text fontSize={15} color="$color10">
            {COPY.dialogNeed}
            {steps.guided ? COPY.dialogGuided : COPY.dialogPlain}
          </Text>
          {steps.guided ? <StepList step={steps.step} note={steps.note} /> : null}
          <Text fontSize={13} color="$color10">
            {COPY.dialogOnlyYou}
          </Text>
          {waiting ? (
            <Text fontSize={13} color="$color10">
              {waiting}
            </Text>
          ) : null}
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
