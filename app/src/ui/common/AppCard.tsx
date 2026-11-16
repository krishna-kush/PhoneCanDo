import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import { useOpening } from '../nav/opening';
import CardMenu, { type CardMenuItem } from './CardMenu';
import OpenMark from './OpenMark';
import PlainText from './PlainText';

type Props = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  menu?: CardMenuItem[];
  menuLabel?: string;
  /** Trailing › when the row navigates (default true when onPress set); a spinner while it opens. */
  chevron?: boolean;
  /** Check mark for the selected row (Env active row). */
  selected?: boolean;
  /** What the plate at its start holds (a logo, a status glyph); none: no plate, the words start the row. */
  icon?: ReactNode;
  /** Hairline box around the icon (false: icon only). */
  plate?: boolean;
  /** More lines under the subtitle (a model's dates). */
  children?: ReactNode;
};

// A hairline row, per the site's plates, with an icon's square plate at its
// start when it has one: no initials or rainbow avatars (the palette has
// exactly two inks). Title/meta truncate so long names never push the
// trailing actions off-screen.
export default function AppCard({
  title,
  subtitle,
  onPress,
  onLongPress,
  menu,
  menuLabel,
  chevron,
  selected,
  icon,
  plate = true,
  children,
}: Props) {
  const showChevron = chevron ?? (onPress != null && menu == null);
  const open = useOpening(showChevron ? onPress : undefined);

  return (
    <XStack
      alignItems="center"
      gap="3"
      borderWidth={1}
      borderColor={selected ? 'primary' : 'line'}
      borderRadius={0}
      padding="3"
      minHeight={72}
      backgroundColor="panel"
      opacity={onPress ? 'press:0.9' : undefined}
      scale={onPress ? 'press:0.99' : undefined}
      onPress={showChevron ? open.press : onPress}
      onLongPress={onLongPress}
    >
      {icon ? (
        <YStack
          width={48}
          height={48}
          borderWidth={plate ? 1 : 0}
          borderColor={selected ? 'primary' : 'lineStrong'}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {icon}
        </YStack>
      ) : null}
      <YStack flex={1} minWidth={0} gap="1" justifyContent="center">
        <PlainText fontSize={16} fontWeight="600" numberOfLines={1} ellipsizeMode="tail">
          {selected ? `✓ ${title}` : title}
        </PlainText>
        {subtitle ? (
          <PlainText
            fontFamily="mono"
            fontSize={12}
            color="dim"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {subtitle}
          </PlainText>
        ) : null}
        {children}
      </YStack>
      {menu && menu.length > 0 ? (
        <CardMenu items={menu} label={menuLabel ?? `Actions for ${title}`} />
      ) : showChevron ? (
        <YStack flexShrink={0} paddingRight="1" opacity={0.5}>
          <OpenMark opening={open.opening} size={18} />
        </YStack>
      ) : null}
    </XStack>
  );
}

// Re-export for callers that only import from AppCard.
export type { CardMenuItem };
