import { YStack } from 'tamagui';

type Props = {
  color?: string;
  dot?: number;
  gap?: number;
};

// Vertical three-dot glyph drawn as views, not text: a `⋮` character carries
// font side-bearings/line-height so it never centers optically inside its
// box. Three symmetric dots are centered by construction on any font.
export default function DotsIcon({ color = '$color', dot = 3, gap = 2.5 }: Props) {
  return (
    <YStack alignItems="center" justifyContent="center" gap={gap} width={24} height={24}>
      {[0, 1, 2].map((i) => (
        <YStack key={i} width={dot} height={dot} borderRadius={dot / 2} backgroundColor={color} />
      ))}
    </YStack>
  );
}
