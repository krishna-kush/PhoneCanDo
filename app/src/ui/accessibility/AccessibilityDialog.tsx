import { useEffect, useState } from 'react';
import * as runner from '../../engine/runner';
import DeckKeys from '../common/actions/DeckKeys';
import PlainText from '../common/PlainText';
import { waitingLine } from '../common/promptQueue';
import SlipDialog from '../common/slip/SlipDialog';
import SlipFrom from '../common/slip/SlipFrom';
import { markAnswered, useBridgePrompts } from '../common/useBridgePrompts';
import { COPY } from './guide';
import StepLinks from './StepLinks';
import StepList from './StepList';
import { useAccessibilitySteps } from './useAccessibilitySteps';

/** After its desk, on the slip. */
const ASKS = 'needs Accessibility';

// An agent asks the bridge for accessibility; this dialog sits over the
// chat while the bridge waits for PhoneCanDo's service to connect, so the
// agent carries on by itself once the switch is on. Only the user can flip
// the Android switch. It shows when the oldest waiting prompt is an
// accessibility request and reports to that request alone. During the guide
// it stays open between trips; it closes once the service connects (every
// waiting request then returns and its prompt is gone), and "Not now" tells
// this request's bridge call to stop waiting. A permission slip from the
// agent, with its face.
export default function AccessibilityDialog() {
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
    <SlipDialog open={prompt !== null} onClose={close} slip="slipAccess">
      {prompt ? <SlipFrom agentId={prompt.agentId} name={prompt.agentName} asks={ASKS} /> : null}
      <PlainText fontSize={17} fontWeight="700">
        {steps.guided ? `Unlock phone control · step ${steps.step} of ${steps.total}` : 'Accessibility permission'}
      </PlainText>
      <PlainText fontSize={15} color="muted">
        {COPY.dialogNeed}
        {steps.guided ? COPY.dialogGuided : COPY.dialogPlain}
      </PlainText>
      {steps.guided ? <StepList step={steps.step} note={steps.note} /> : null}
      {[COPY.dialogOnlyYou, waiting, msg]
        .filter((line) => line)
        .map((line) => (
          <PlainText key={line} fontSize={13} color="muted">
            {line}
          </PlainText>
        ))}
      <DeckKeys
        actions={[
          { label: steps.guided ? steps.copy.button : 'Open settings', role: 'go', onPress: openStep },
          { label: 'Not now', role: 'back', onPress: close },
        ]}
      />
      <StepLinks
        links={[
          ...(steps.alt ? [{ label: steps.alt.label, onPress: runAlt }] : []),
          ...(steps.guided ? steps.fixes.map((fix) => ({ label: fix.label, onPress: () => steps.goTo(fix.to) })) : []),
          ...(steps.canForce ? [{ label: COPY.forceGuide, onPress: steps.forceGuide }] : []),
        ]}
      />
    </SlipDialog>
  );
}
