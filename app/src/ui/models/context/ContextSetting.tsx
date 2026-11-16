import { XStack, YStack } from 'tamagui';
import type { LocalModel } from '../../../engine/models/types';
import PlainText from '../../common/PlainText';
import RowGroup from '../../common/rows/RowGroup';
import Note from '../../env/parts/Note';
import { automaticNote, chooseNote, contextAt, contextText, SPEED_NOTE } from '../logic/context';
import ChoiceRow from '../parts/ChoiceRow';
import ContextSlider from './ContextSlider';

type Props = {
  model: LocalModel;
  automatic: boolean;
  /** The slider's position (logic/context.ts). */
  stop: number;
  disabled: boolean;
  onAutomatic: (automatic: boolean) => void;
  onStop: (stop: number) => void;
};

// A model's Context, under its Memory setting's Advanced: Automatic (what
// the phone can spare when the model starts) or a context of your own on a
// slider. The Memory setting holds the choice, saves it with the rest and
// shows what our planner makes of it in its line.
export default function ContextSetting({ model, automatic, stop, disabled, onAutomatic, onStop }: Props) {
  const range = model.contextRange;
  return (
    <YStack gap="2">
      <RowGroup title="Context" radio>
        <ChoiceRow label="Automatic" note={automaticNote(model)} selected={automatic} disabled={disabled} onPress={() => onAutomatic(true)} />
        <ChoiceRow label="Choose" note={chooseNote(range)} selected={!automatic} disabled={disabled} onPress={() => onAutomatic(false)} />
      </RowGroup>
      <Note>{SPEED_NOTE}</Note>
      {!automatic ? (
        <XStack alignItems="center" gap="3">
          <ContextSlider range={range} stop={stop} disabled={disabled} onStop={onStop} />
          <PlainText fontFamily="mono" fontSize={14} minWidth={48} textAlign="right">
            {contextText(contextAt(range, stop))}
          </PlainText>
        </XStack>
      ) : null}
    </YStack>
  );
}
