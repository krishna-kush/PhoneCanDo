import { XStack, YStack } from 'tamagui';
import StillFace from '../../common/face/StillFace';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { NOTHING_RUNNING } from '../logic/memoryCopy';

// Nothing of ours runs: the box the agents and models would be in, with
// one unit dozing in it.
export default function EmptyBox() {
  return (
    <RowGroup title="Agents & models">
      <RowFrame>
        <XStack alignItems="center" gap="3">
          <YStack opacity={0.6} accessibilityElementsHidden>
            <StillFace mood="asleep" size={22} />
          </YStack>
          <PlainText fontSize={14} color="muted" flex={1}>
            {NOTHING_RUNNING}
          </PlainText>
        </XStack>
      </RowFrame>
    </RowGroup>
  );
}
