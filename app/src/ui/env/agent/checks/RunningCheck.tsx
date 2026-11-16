import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { YStack } from 'tamagui';
import type { CheckRun } from '../../../../engine/checks/types';
import { useAgentsStore } from '../../../../state/agents';
import { useAppStore } from '../../../../state/app';
import { useChecksStore } from '../../../../state/checks';
import AppButton from '../../../common/AppButton';
import ConfirmDialog from '../../../common/ConfirmDialog';
import PlainText from '../../../common/PlainText';
import { useNow } from '../../../common/time/useNow';
import { usePageActive } from '../../../nav/pageActive';
import { runHasRows } from './logic/rows';
import { CANCEL_CHECK, checkingLine, movedLine, NOT_NOW, needsYou, openAgentLabel, stepLine, stepView } from './logic/run';
import ReadingBar from './ReadingBar';

/** How often the time since anything moved counts on. */
const TICK_MS = 1000;

type Props = { agentId: string; name: string; run: CheckRun };

// A check's head while it runs: "Checking <name>", how long since anything
// moved (each second; in ACP mode the runner stops a check nothing moves in
// for 3 minutes, in its own app it waits for you after one), a link to the
// agent while a question of its waits for you or it may be asking you
// something in its own app (with a dialog saying so, once each time it
// starts to while the page is in front), and Cancel check, which stops the
// agent to free memory. Each row says where
// the check is with it; a runner that sends no rows gets the step here.
export default function RunningCheck({ agentId, name, run }: Props) {
  const active = usePageActive();
  const now = useNow(active, TICK_MS);
  const step = stepView(run, name);
  const moved = movedLine(run, now);
  const stepHere = step != null && !runHasRows(run);

  // Its question shows on Home (the permission dialog or its own app), so
  // the agent becomes the active one first.
  const openAgent = () => {
    const agents = useAgentsStore.getState();
    if (agents.activeAgentId !== agentId) void agents.setActiveAgent(agentId);
    useAppStore.getState().showHome();
  };

  // It may need you: the dialog once per wait, when the page is in front.
  const asks = run.step === 'waiting' || run.step === 'answer' ? run.step : null;
  const [dialog, setDialog] = useState(false);
  const told = useRef(false);
  useEffect(() => {
    if (!asks) {
      told.current = false;
      setDialog(false);
    } else if (active && !told.current) {
      told.current = true;
      setDialog(true);
    }
  }, [asks, active]);
  const words = asks ? needsYou(asks, name) : null;

  return (
    <YStack gap="2">
      <YStack gap="1">
        <PlainText fontSize={16} fontWeight="600">
          {checkingLine(name)}
        </PlainText>
        {stepHere ? (
          <PlainText fontFamily="mono" fontSize={12} color="secondaryInk">
            {stepLine(step)}
          </PlainText>
        ) : null}
        {stepHere && step.progress != null ? <ReadingBar progress={step.progress} /> : null}
        {moved ? (
          <PlainText fontFamily="mono" fontSize={11} color="dim">
            {moved}
          </PlainText>
        ) : null}
        {step?.openAgent ? (
          <Pressable onPress={openAgent} hitSlop={8} accessibilityRole="link" accessibilityLabel={openAgentLabel(name)}>
            <PlainText fontSize={15} fontWeight="600" color="secondaryInk">
              {openAgentLabel(name)}
            </PlainText>
          </Pressable>
        ) : null}
      </YStack>
      <AppButton variant="secondary" onPress={() => useChecksStore.getState().checkCancel(agentId)}>
        {CANCEL_CHECK}
      </AppButton>
      {words ? (
        <ConfirmDialog
          open={dialog}
          onClose={() => setDialog(false)}
          title={words.title}
          message={words.message}
          cancelLabel={NOT_NOW}
          confirmLabel={words.open}
          confirmVariant="primary"
          onConfirm={() => {
            setDialog(false);
            openAgent();
          }}
        />
      ) : null}
    </YStack>
  );
}
