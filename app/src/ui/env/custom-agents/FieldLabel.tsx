import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { spokenLabel, tagText, type FieldHelp, type FieldTag } from '../logic/customAgentText';
import InfoButton from './help/InfoButton';

type Props = { label: string; tag?: FieldTag; size?: 15 | 16; help?: FieldHelp | null };

// A field's label, then its mark in dim mono ("Name · needed"), never red:
// it says what must be filled in, not what is wrong. Then its ⓘ, on the
// same line, never beside the input.
export default function FieldLabel({ label, tag, size = 15, help }: Props) {
  return (
    <XStack alignItems="center" gap="2" flexWrap="wrap">
      <XStack alignItems="baseline" gap="2" accessibilityLabel={spokenLabel(label, tag)}>
        <PlainText fontSize={size} fontWeight="600">
          {label}
        </PlainText>
        {tag ? (
          <PlainText fontFamily="mono" fontSize={12} color="dim">
            {tagText(tag)}
          </PlainText>
        ) : null}
      </XStack>
      <InfoButton label={label} help={help} />
    </XStack>
  );
}
