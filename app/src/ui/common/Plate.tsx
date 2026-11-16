import type { ComponentProps } from 'react';
import { YStack } from 'tamagui';

// How far the hard amber shadow sits off a plate, in dp.
const SHADOW = 4;

// A printed plate on the site's hard amber shadow (its `--plate-shadow`,
// at phone size): a panel in a strong hairline, the shadow down and to the
// right, with room kept for it so nothing clips it. About's spec plate and
// postcard, the build's shipping label, the Account pass and the crew
// badge are each one; their insides are their own.
export default function Plate(props: ComponentProps<typeof YStack>) {
  return (
    <YStack
      marginRight={SHADOW}
      marginBottom={SHADOW}
      borderWidth={1}
      borderColor="lineStrong"
      backgroundColor="panel"
      boxShadow={`${SHADOW}px ${SHADOW}px 0 secondary`}
      {...props}
    />
  );
}
