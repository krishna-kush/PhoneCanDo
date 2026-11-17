import { XStack } from 'tamagui';
import { pickTime } from '../../../../engine/pick';
import AppInput from '../../../common/AppInput';
import PlainText from '../../../common/PlainText';
import { parseClock } from '../../logic/clock';
import type { Draft } from '../../logic/draft';
import { TIME_PLACEHOLDER } from '../../logic/editorCopy';
import PickBox from '../PickBox';

type Props = { draft: Draft; onChange: (d: Draft) => void; dialogs: boolean };

const TILE = 56;

// The time on two split-flap tiles, hours and minutes, either opening
// Android's time dialog (a screen reader hears them as one button). A
// build without the dialogs types it instead, on the 24-hour clock ("930"
// reads 09:30 once you leave the field).
export default function TimeTiles({ draft, onChange, dialogs }: Props) {
  if (!dialogs) {
    return (
      <AppInput
        value={draft.time}
        onChangeText={(time) => onChange({ ...draft, time })}
        onBlur={() => {
          const time = parseClock(draft.time);
          if (time && time !== draft.time) onChange({ ...draft, time });
        }}
        placeholder={TIME_PLACEHOLDER}
        keyboardType="numbers-and-punctuation"
        width={120}
        fontFamily="mono"
        accessibilityLabel="Time, 24-hour clock"
      />
    );
  }
  const time = parseClock(draft.time) ?? TIME_PLACEHOLDER;
  const [hours, minutes] = time.split(':');
  const pick = async () => {
    const next = await pickTime(time);
    if (next) onChange({ ...draft, time: next });
  };
  return (
    <XStack
      alignItems="center"
      gap="1"
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Time: ${time}`}
      accessibilityHint="Opens a picker"
      onPress={pick}
    >
      <PickBox value={hours} onPress={pick} accessibilityLabel="Hour" width={TILE} />
      <PlainText fontFamily="mono" fontSize={26} fontWeight="600" color="dim">
        :
      </PlainText>
      <PickBox value={minutes} onPress={pick} accessibilityLabel="Minute" width={TILE} />
    </XStack>
  );
}
