import type { AccessibilityActionEvent } from 'react-native';
import { Slider } from 'tamagui';
import type { ContextRange } from '../../../engine/models/types';
import { HIT, useTheme } from '../../common/globals';
import { contextAt, contextText, lastStop } from '../logic/context';

const TRACK = 4;
const THUMB = 24;

type Props = {
  range: ContextRange;
  /** The position: whole steps from the range's min (logic/context.ts). */
  stop: number;
  disabled?: boolean;
  onStop: (stop: number) => void;
};

// The Context setting's slider (Tamagui's, plain JS): a thin square track in
// a 48dp touch band, the part up to the thumb in the primary colour. A
// screen reader hears the context ("64k tokens") and steps it with its
// increment and decrement actions.
export default function ContextSlider({ range, stop, disabled = false, onStop }: Props) {
  const t = useTheme();
  const last = lastStop(range);
  const step = (by: number) => onStop(Math.min(last, Math.max(0, stop + by)));
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') step(1);
    if (e.nativeEvent.actionName === 'decrement') step(-1);
  };
  return (
    <Slider
      flex={1}
      height={HIT.minTouch}
      min={0}
      max={last}
      step={1}
      value={[stop]}
      disabled={disabled}
      onValueChange={([v]) => onStop(v ?? 0)}
      opacity={disabled ? 0.5 : 1}
    >
      <Slider.Track height={TRACK} marginTop={(HIT.minTouch - TRACK) / 2} borderRadius={0} backgroundColor={t.line}>
        <Slider.TrackActive borderRadius={0} backgroundColor={t.primary} />
      </Slider.Track>
      <Slider.Thumb
        index={0}
        size={THUMB}
        circular={false}
        borderRadius={0}
        borderWidth={2}
        borderColor={t.primary}
        backgroundColor={t.panel}
        pressStyle={{ backgroundColor: t.primarySoft, borderColor: t.primary }}
        aria-label="Context"
        aria-valuetext={`${contextText(contextAt(range, stop))} tokens`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
      />
    </Slider>
  );
}
