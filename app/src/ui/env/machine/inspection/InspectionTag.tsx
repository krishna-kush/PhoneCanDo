import { XStack, YStack } from 'tamagui';
import PlainText from '../../../common/PlainText';
import Plate from '../../../common/Plate';
import DashedRule from '../../../common/rows/DashedRule';
import KeyHead from '../../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../../common/rows/place';
import Stamp from '../../../common/Stamp';
import { type Check, clockOf, type Glance, glanceLine, inspectionChecks } from '../logic/glance';
import type { MachineTool } from '../logic/machineTools';

// A check box's side.
const BOX = 18;

type Props = {
  glance: Glance;
  /** Its tools, needed ones first (logic/machineTools.ts); empty without Linux. */
  tools: readonly MachineTool[];
  /** The kind whose needs they are, or null when its agents are of several kinds. */
  who: string | null;
  linux: boolean;
  /** Types the line that installs the missing tools into a terminal; null with nothing to install. */
  onInstall: (() => void) | null;
  /** When the look inside last read; null before. A new reading slams the stamp on again. */
  readAt: number | null;
};

// The machine's inspection tag, as a field manual's: a checklist
// (its state, what its agents need, its space, the tools that are here),
// each box ticked, crossed or still open; a failed needs line types the
// install line into a terminal on a tap. Under a dashed rule, what it is,
// and the INSPECTED stamp, slammed on again by each look inside.
export default function InspectionTag(p: Props) {
  const checks = inspectionChecks(p.glance, p.tools, p.who, p.linux, p.onInstall != null);
  return (
    <Plate marginTop="3">
      <KeyHead title="Inspection" barcode="machineInspection" />
      <YStack padding={ROW_GUTTER} gap="3">
        {checks.map((c) => (
          <CheckLine key={c.label} check={c} onInstall={c.install ? p.onInstall : null} />
        ))}
      </YStack>
      <YStack height={1}>
        <DashedRule />
      </YStack>
      <XStack padding={ROW_GUTTER} gap="3" alignItems="center">
        <YStack flex={1} minWidth={0}>
          <PlainText fontFamily="mono" fontSize={12} color="dim">
            {glanceLine(p.glance)}
          </PlainText>
        </YStack>
        {p.readAt != null ? (
          <Stamp key={p.readAt} slam>
            {`Inspected ${clockOf(p.readAt)}`}
          </Stamp>
        ) : null}
      </XStack>
    </Plate>
  );
}

function CheckLine({ check, onInstall }: { check: Check; onInstall: (() => void) | null }) {
  const ink = check.ok === true ? 'secondaryInk' : check.ok === false ? 'primary' : 'dim';
  const mark = check.ok === true ? '✓' : check.ok === false ? '✗' : '·';
  return (
    <XStack
      gap="3"
      alignItems="flex-start"
      opacity={onInstall ? 'press:0.7' : 1}
      onPress={onInstall ?? undefined}
      accessibilityRole={onInstall ? 'button' : undefined}
      accessibilityLabel={`${check.label}${onInstall ? ': tap to install' : ''}`}
    >
      <YStack width={BOX} height={BOX} alignItems="center" justifyContent="center" borderWidth={1.5} borderColor={check.ok == null ? 'line' : ink}>
        <PlainText fontFamily="mono" fontSize={13} fontWeight="700" color={ink}>
          {mark}
        </PlainText>
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <PlainText fontFamily="mono" fontSize={13} color={check.ok === false ? 'primary' : 'fg'}>
          {check.label}
        </PlainText>
        {onInstall ? (
          <PlainText fontFamily="mono" fontSize={11} color="primary" textTransform="uppercase" letterSpacing={1}>
            Tap to install
          </PlainText>
        ) : null}
      </YStack>
    </XStack>
  );
}
