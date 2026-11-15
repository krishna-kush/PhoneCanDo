import { YStack } from 'tamagui';
import type { CapabilityCheck, CheckRun } from '../../../../engine/checks/types';
import PlainText from '../../../common/PlainText';
import SectionTitle from '../../../common/SectionTitle';
import { capabilityLabel } from './logic/copy';
import { checkGroups, rowLine } from './logic/rows';
import ReadingBar from './ReadingBar';

type Props = { capabilities: CapabilityCheck[]; run: CheckRun | null; name: string; now: number };

// The capabilities by where they run, "In ACP mode" and "In its own app",
// each group a panel (one with nothing set up is left out). A row is its
// name, then a mono line: its state (checked with which version and when,
// not checked yet, not working and why, or off) or, while a check runs,
// where the check is with it, with the reading bar under a row being
// tested. An Off row is dimmed.
export default function CapabilityRows({ capabilities, run, name, now }: Props) {
  return (
    <>
      {checkGroups(capabilities).map((group) => (
        <YStack key={group.id} gap="2">
          <SectionTitle>{group.title}</SectionTitle>
          <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
            {group.checks.map((check, i) => {
              const line = rowLine(check, run, name, now);
              return (
                <YStack
                  key={check.id}
                  gap="1"
                  paddingHorizontal="3"
                  paddingVertical="2"
                  borderTopWidth={i > 0 ? 1 : 0}
                  borderColor="line"
                  opacity={check.state === 'off' ? 0.6 : 1}
                >
                  <PlainText fontSize={16} fontWeight="500">
                    {capabilityLabel(check.id)}
                  </PlainText>
                  <PlainText fontFamily="mono" fontSize={12} color={line.tone}>
                    {line.text}
                  </PlainText>
                  {line.progress != null ? <ReadingBar progress={line.progress} /> : null}
                </YStack>
              );
            })}
          </YStack>
        </YStack>
      ))}
    </>
  );
}
