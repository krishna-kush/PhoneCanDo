import { XStack } from 'tamagui';
import PlainText from './PlainText';

type Props = {
  term: string;
  value: string;
  /** The term's column, in dp, so a stack of lines keeps one edge. */
  termWidth?: number;
  /** Lines the value may take. */
  lines?: number;
  /** muted: a quieter value (the crew badge); blank: a form not filled in yet, faint and not selectable. */
  tone?: 'fg' | 'muted' | 'blank';
};

// One printed line of a plate, pass, label or badge (About's spec plate,
// the build's shipping label, the Account pass, the crew badge): its term
// in faint mono capitals, its value in mono.
export default function FieldLine({ term, value, termWidth = 64, lines = 1, tone = 'fg' }: Props) {
  return (
    <XStack gap="3" alignItems="baseline">
      <PlainText fontFamily="mono" fontSize={10} fontWeight="500" letterSpacing={1.2} textTransform="uppercase" color="faint" width={termWidth}>
        {term}
      </PlainText>
      <PlainText
        fontFamily="mono"
        fontSize={13}
        color={tone === 'blank' ? 'faint' : tone}
        flex={1}
        numberOfLines={lines}
        userSelect={tone === 'blank' ? 'none' : 'text'}
      >
        {value}
      </PlainText>
    </XStack>
  );
}
