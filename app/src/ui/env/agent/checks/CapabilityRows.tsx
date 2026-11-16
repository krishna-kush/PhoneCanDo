import { YStack } from 'tamagui';
import type { CapabilityCheck, CheckRun } from '../../../../engine/checks/types';
import PlainText from '../../../common/PlainText';
import { ROW_GUTTER } from '../../../common/rows/place';
import RowFrame from '../../../common/rows/RowFrame';
import RowGroup from '../../../common/rows/RowGroup';
import { capabilityLabel } from './logic/copy';
import { acpWake, checkGroups, rowDimmed, rowLine } from './logic/rows';
import ReadingBar from './ReadingBar';

type Props = { capabilities: CapabilityCheck[]; run: CheckRun | null; name: string; now: number };

// The capabilities by where they run, "In ACP mode" and "In its own app",
// each a RowGroup (one with nothing set up is left out). A row is its
// name, then a mono line: its state (checked with which version and when,
// not checked yet, not working and why, or off) or, while a check runs,
// where the check is with it, with the reading bar under a row being
// tested. An Off row is dimmed, but for Woken while idle of an agent that
// wakes in ACP mode, which says so.
export default function CapabilityRows({ capabilities, run, name, now }: Props) {
  const acp = acpWake(capabilities);
  return (
    <>
      {checkGroups(capabilities).map((group) => (
        <RowGroup key={group.id} title={group.title}>
          {group.checks.map((check) => {
            const line = rowLine(check, run, name, now, acp);
            return (
              <RowFrame key={check.id} bare>
                <YStack gap="1" paddingHorizontal={ROW_GUTTER} paddingVertical="2" opacity={rowDimmed(check, acp) ? 0.6 : 1}>
                  <PlainText fontSize={16} fontWeight="500">
                    {capabilityLabel(check.id)}
                  </PlainText>
                  <PlainText fontFamily="mono" fontSize={12} color={line.tone}>
                    {line.text}
                  </PlainText>
                  {line.progress != null ? <ReadingBar progress={line.progress} /> : null}
                </YStack>
              </RowFrame>
            );
          })}
        </RowGroup>
      ))}
    </>
  );
}
