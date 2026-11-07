import type { ReactNode } from 'react';
import { Button, Text, XStack } from 'tamagui';
import BackIcon from '../../common/BackIcon';
import { HIT } from '../../common/globals';

// Back arrow + page title for the Env tab's sub-pages. The title truncates so
// a trailing action (rename, ⋮) never leaves the screen.
export default function PageHeader({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  return (
    <XStack alignItems="center" gap="$2" marginLeft={-12}>
      <Button
        width={HIT.minTouch}
        height={HIT.minTouch}
        borderRadius={0}
        chromeless
        flexShrink={0}
        paddingHorizontal={0}
        justifyContent="center"
        alignItems="center"
        onPress={onBack}
        accessibilityLabel="Back"
      >
        <BackIcon size={22} />
      </Button>
      <Text fontSize={20} fontWeight="700" numberOfLines={1} ellipsizeMode="tail" flex={1} minWidth={0}>
        {title}
      </Text>
      {trailing}
    </XStack>
  );
}
