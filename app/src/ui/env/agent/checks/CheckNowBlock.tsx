import { useState } from 'react';
import { YStack } from 'tamagui';
import type { AgentChecks } from '../../../../engine/checks/types';
import { useChecksStore } from '../../../../state/checks';
import ActionDeck from '../../../common/actions/ActionDeck';
import ConfirmDialog from '../../../common/ConfirmDialog';
import PlainText from '../../../common/PlainText';
import { useShowScreenEnd } from '../../../common/screenEnd';
import Note from '../../parts/Note';
import {
  CHECK_ALL,
  CHECK_ALL_TITLE,
  CHECK_NOW,
  CHECK_NOW_TITLE,
  CHECK_REST,
  CHECK_REST_TITLE,
  checkChoices,
  checkNowMessage,
  checkRestMessage,
  resultLines,
} from './logic/run';
import RunningCheck from './RunningCheck';

type Props = { agentId: string; name: string; checks: AgentChecks; now: number };

// Check now, under the rows: buttons that ask first (each restarts the
// agent with a short test task, in one part or two). Before anything is
// checked, Check now checks everything; after, Check the rest checks only
// what isn't checked yet and Check all again everything (checkChoices).
// Then the run while it goes (RunningCheck, with Cancel check), and how the
// last check ended. Why it can't start shows in red under it, scrolled
// into view; a kind that can't start with a task gets a line saying so
// instead.
export default function CheckNowBlock({ agentId, name, checks, now }: Props) {
  const [asking, setAsking] = useState<'rest' | 'all' | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const showEnd = useShowScreenEnd();
  const run = checks.run;
  const result = run ? resultLines(run, now) : null;
  const choices = checkChoices(checks);
  const rest = asking === 'rest' ? checks.rest : null;

  const ask = (mode: 'rest' | 'all') => {
    setRefused(null);
    setAsking(mode);
  };

  const start = () => {
    const full = asking !== 'rest';
    setAsking(null);
    setRefused(useChecksStore.getState().checkNow(agentId, full));
  };

  return (
    <YStack gap="2">
      {run?.state === 'running' ? (
        <RunningCheck agentId={agentId} name={name} run={run} />
      ) : checks.checkNow ? (
        <ActionDeck
          barcode="deckCheckNow"
          actions={[
            choices.rest && { label: CHECK_REST, role: 'go', mark: 'play', onPress: () => ask('rest') },
            { label: choices.all, role: choices.rest ? 'more' : 'go', mark: 'play', onPress: () => ask('all') },
          ]}
        />
      ) : (
        <Note>{checks.checkNowWhy ?? "It can't start with a task, so only real use checks it."}</Note>
      )}
      {/* At the page's foot, below the fold once the rows fill the screen: it scrolls into view. */}
      {refused ? (
        <YStack onLayout={() => showEnd?.()}>
          <Note tone="error">{refused}</Note>
        </YStack>
      ) : null}
      {result ? (
        <YStack gap="1">
          <PlainText fontFamily="mono" fontSize={12} color={result.tone}>
            {result.head}
          </PlainText>
          <Note tone={result.tone === 'primary' ? 'error' : 'muted'}>{result.detail}</Note>
        </YStack>
      ) : null}
      <ConfirmDialog
        open={asking != null}
        onClose={() => setAsking(null)}
        title={rest ? CHECK_REST_TITLE : choices.all === CHECK_ALL ? CHECK_ALL_TITLE : CHECK_NOW_TITLE}
        message={rest ? checkRestMessage(name, rest, checks.checkModel) : checkNowMessage(name, checks.parts, checks.checkModel)}
        confirmLabel={rest ? CHECK_REST : choices.all}
        confirmVariant="primary"
        confirmMark="play"
        onConfirm={start}
      />
    </YStack>
  );
}
