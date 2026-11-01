import type { ReactNode } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import ArrowIcon from './ArrowIcon';
import CardMenu, { type CardMenuItem } from './CardMenu';
import { useTheme } from './globals';

type Props = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  menu?: CardMenuItem[];
  menuLabel?: string;
  /** Trailing › when the row navigates (default true when onPress set). */
  chevron?: boolean;
  /** Check mark for the selected row (Env active row). */
  selected?: boolean;
  /** Replaces the initial in the index plate (logo, status glyph). */
  icon?: ReactNode;
  /** Hairline box around the index plate (false: icon only). */
  plate?: boolean;
};

// Square index plate + hairline row, per the site's plates: no rainbow
// avatars (the palette has exactly two inks). Title/meta truncate so long
// names never push the trailing actions off-screen.
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
}: Props) {
  const t = useTheme();
  const initial = (title.replace(/^\.+/, '').trim().charAt(0) || '•').toUpperCase();
  const showChevron = chevron ?? (onPress != null && menu == null);

  return (
    <XStack
      alignItems="center"
      gap="$3"
      borderWidth={1}
      borderColor={selected ? t.primary : t.line}
      borderRadius={0}
      padding="$3"
      minHeight={72}
      backgroundColor={t.panel}
      pressStyle={onPress ? { opacity: 0.9, scale: 0.99 } : undefined}
      onPress={onPress}
    >
      <YStack
        width={48}
        height={48}
        borderWidth={plate ? 1 : 0}
        borderColor={selected ? t.primary : t.lineStrong}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {icon ?? (
          <Text
            fontFamily="$mono"
            fontSize={18}
            fontWeight="600"
            color={selected ? t.primary : t.secondaryInk}
          >
            {initial}
          </Text>
        )}
      </YStack>
      <YStack flex={1} minWidth={0} gap="$1" justifyContent="center">
        <Text fontSize={16} fontWeight="600" numberOfLines={1} ellipsizeMode="tail">
          {selected ? `✓ ${title}` : title}
        </Text>
        {subtitle ? (
          <Text
            fontFamily="$mono"
            fontSize={12}
            color={t.dim}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {menu && menu.length > 0 ? (
        <CardMenu items={menu} label={menuLabel ?? `Actions for ${title}`} />
      ) : showChevron ? (
        <YStack flexShrink={0} paddingRight="$1" opacity={0.5}>
          <ArrowIcon dir="right" size={18} />
        </YStack>
      ) : null}
    </XStack>
  );
}

// Re-export for callers that only import from AppCard.
export type { CardMenuItem };
