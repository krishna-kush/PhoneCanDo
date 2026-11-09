import { Text, XStack, YStack } from 'tamagui';
import type { Offer } from '../../../engine/agents/offers';
import { useTheme } from '../../common/globals';
import { blockedText, offerBadges } from '../logic/agentChoice';
import Badge from '../parts/Badge';

type Props = { offer: Offer; selected: boolean; onSelect: () => void };

// One kind in the Choose agent step: a radio mark, its name and badges.
// A blocked kind is dimmed, cannot be picked, and says why in one line.
export default function KindOption({ offer, selected, onSelect }: Props) {
  const t = useTheme();
  const reason = blockedText(offer.blocked);
  const badges = offerBadges(offer);
  const disabled = reason != null;

  return (
    <XStack
      alignItems="center"
      gap="$3"
      minHeight={64}
      padding="$3"
      borderWidth={1}
      borderColor={selected ? t.primary : t.line}
      backgroundColor={t.panel}
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled ? undefined : { opacity: 0.9, scale: 0.99 }}
      onPress={disabled ? undefined : onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[offer.label, ...badges, reason].filter(Boolean).join(', ')}
    >
      <Text fontFamily="$mono" fontSize={14} width={16} textAlign="center" color={selected ? t.primary : t.faint}>
        {selected ? '●' : '○'}
      </Text>
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          <Text fontSize={16} fontWeight="600" numberOfLines={1} ellipsizeMode="tail" flexShrink={1}>
            {offer.label}
          </Text>
          {badges.map((b) => (
            <Badge key={b} label={b} />
          ))}
        </XStack>
        {reason ? (
          <Text fontFamily="$mono" fontSize={12} color={t.dim} numberOfLines={1}>
            {reason}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  );
}
