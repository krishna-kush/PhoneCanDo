import { useMemo } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { LICENSE_TEXT } from '../licenseText';
import { licenseBlocks, type LicenseBlock } from '../logic/blocks';

// Our license, word for word, as blocks the phone wraps at its own width
// (logic/blocks.ts): its name, each section's heading, the paragraphs, and
// the list items behind their marks, a list inside an item set in further.
// Read only once its page opens.
export default function LicenseBody() {
  const blocks = useMemo(() => licenseBlocks(LICENSE_TEXT), []);
  return (
    <YStack gap="3">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </YStack>
  );
}

function Block({ block }: { block: LicenseBlock }) {
  switch (block.kind) {
    case 'title':
      return (
        <PlainText fontSize={19} fontWeight="700" userSelect="text">
          {block.text}
        </PlainText>
      );
    case 'heading':
      return (
        <YStack paddingTop="2">
          <PlainText fontSize={16} fontWeight="700" userSelect="text">
            {block.text}
          </PlainText>
        </YStack>
      );
    case 'paragraph':
      return (
        <PlainText fontSize={14} lineHeight="21px" userSelect="text">
          {block.text}
        </PlainText>
      );
    case 'item':
      return (
        <XStack gap="2" paddingLeft={block.depth * 18} alignItems="flex-start">
          <PlainText fontFamily="mono" fontSize={13} lineHeight="21px" color="dim" width={18}>
            {block.mark}
          </PlainText>
          <PlainText fontSize={14} lineHeight="21px" flex={1} userSelect="text">
            {block.text}
          </PlainText>
        </XStack>
      );
  }
}
