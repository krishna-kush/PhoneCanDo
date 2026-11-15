import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import AppButton from '../../common/AppButton';
import LogoLoader from '../../common/LogoLoader';
import PlainText from '../../common/PlainText';
import { useBridgePrompts } from '../../common/useBridgePrompts';
import { useHomeInFront } from '../../nav/homeInFront';
import { ANSWER_GONE, endLine, NOTHING_YET, runHeader, STOP, STOPPING } from './logic/copy';
import { rowsOf } from './logic/transcript';
import PermissionQuestion from './PermissionQuestion';
import RunItemRow from './RunItemRow';
import { setShownRun } from './shownRun';
import { useBackgroundRun } from './useBackgroundRun';

type Props = {
  agentId: AgentId;
  /** The agent's name, as the header and the question say it. */
  name: string;
  /** An ACP turn is running (its engine's status). */
  busy: boolean;
};

// Near the end counts as at the end: a new row follows only a reader there.
const END_SLACK = 48;

// Home of a TUI agent while its engine runs in ACP mode: a task that came
// while nobody watched (a schedule, a message that woke it) runs without a
// screen, and this is a small live view of it: the line saying so, the
// agent's text, its thinking (closed), its tool steps with their status,
// its plan, its permission question with one button per answer, and Stop.
// Once the turn is over the terminal comes back (useTuiEngine asks), the
// same chat open in it.
export default function BackgroundRunView({ agentId, name, busy }: Props) {
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  const { run, stopping, stop, answer } = useBackgroundRun(agentId);
  const [gone, setGone] = useState(false);
  const inFront = useHomeInFront();
  const rows = useMemo(() => rowsOf(run.items), [run.items]);
  // The run's question, else the same question as the prompt queue has it
  // (the dialog leaves it to this card, so it must show here either way).
  const { queue } = useBridgePrompts();
  const queued = queue.find((p) => p.kind === 'permission' && p.agentId === agentId && (p.options?.length ?? 0) > 0);
  const permission =
    run.permission ??
    (queued ? { requestId: queued.requestId, title: queued.title ?? '', toolKind: queued.toolKind ?? null, options: queued.options ?? [] } : null);
  const working = busy || state === 'starting' || permission != null;
  const ended = working ? null : endLine(run.end);
  const askId = permission?.requestId ?? null;
  useEffect(() => {
    if (askId) setGone(false);
  }, [askId]);

  // The question is answered on its card here, not in the app-wide dialog.
  useEffect(() => {
    if (!inFront) return;
    setShownRun(agentId);
    return () => setShownRun(null);
  }, [agentId, inFront]);

  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const atEnd = useRef(true);

  return (
    <YStack flex={1} backgroundColor="bg">
      <YStack paddingHorizontal="4" paddingVertical="3" gap="2" borderBottomWidth={1} borderColor="line">
        <XStack gap="3" alignItems="center">
          {working ? <LogoLoader size={16} /> : null}
          <PlainText fontSize={16} fontWeight="600" flexShrink={1}>
            {runHeader(name, working)}
          </PlainText>
        </XStack>
        {ended ? (
          <PlainText fontSize={13} color="muted" userSelect="text">
            {ended}
          </PlainText>
        ) : null}
        {gone ? (
          <PlainText fontSize={13} color="muted">
            {ANSWER_GONE}
          </PlainText>
        ) : null}
      </YStack>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          atEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - END_SLACK;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (atEnd.current) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {rows.length > 0 ? (
          rows.map((item) => <RunItemRow key={item.id} item={item} />)
        ) : (
          <PlainText fontSize={14} color="dim">
            {NOTHING_YET}
          </PlainText>
        )}
      </ScrollView>
      {permission ? (
        <YStack borderTopWidth={1} borderColor="lineStrong" backgroundColor="panel" padding="4">
          <PermissionQuestion
            agentName={name}
            title={permission.title}
            toolKind={permission.toolKind}
            options={permission.options}
            onAnswer={(optionId) => setGone(!answer(permission.requestId, optionId))}
          />
        </YStack>
      ) : null}
      {working ? (
        <YStack paddingHorizontal="4" paddingVertical="3" borderTopWidth={1} borderColor="line">
          <AppButton variant="secondary" loading={stopping} onPress={stop}>
            {stopping ? STOPPING : STOP}
          </AppButton>
        </YStack>
      ) : null}
    </YStack>
  );
}
