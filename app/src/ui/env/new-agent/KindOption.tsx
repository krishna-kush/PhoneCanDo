import { XStack, YStack } from 'tamagui';
import type { Offer } from '../../../engine/agents/offers';
import { agentKind } from '../../../engine/agents/registry';
import { levelTag } from '../../messages/logic/levels';
import { blockedText, offerBadges } from '../logic/agentChoice';
import Badge from '../parts/Badge';
import PlainText from '../../common/PlainText';

type Props = { offer: Offer; selected: boolean; onSelect: () => void };

// One kind in the Choose agent step: a radio mark, its name and badges,
// and how far other agents' messages reach it (its level). A blocked kind
// is dimmed, cannot be picked, and says why in that line instead.
export default function KindOption({ offer, selected, onSelect }: Props) {
  const reason = blockedText(offer.blocked);
  const badges = offerBadges(offer);
  const level = agentKind(offer.id).messaging;
  const disabled = reason != null;

  return (
    <XStack
      alignItems="center"
      gap="3"
      minHeight={64}
      padding="3"
      borderWidth={1}
      borderColor={selected ? 'primary' : 'line'}
      backgroundColor="panel"
      opacity={disabled ? 0.5 : '1 press:0.9'}
      scale={disabled ? undefined : 'press:0.99'}
      onPress={disabled ? undefined : onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[offer.label, ...badges, levelTag(level), reason].filter(Boolean).join(', ')}
    >
      <PlainText fontFamily="mono" fontSize={14} width={16} textAlign="center" color={selected ? 'primary' : 'faint'}>
        {selected ? '●' : '○'}
      </PlainText>
      <YStack flex={1} minWidth={0} gap="1">
        <XStack alignItems="center" gap="2" flexWrap="wrap">
          <PlainText fontSize={16} fontWeight="600" numberOfLines={1} ellipsizeMode="tail" flexShrink={1}>
            {offer.label}
          </PlainText>
          {badges.map((b) => (
            <Badge key={b} label={b} />
          ))}
        </XStack>
        {reason ? (
          <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
            {reason}
          </PlainText>
        ) : (
          <PlainText fontFamily="mono" fontSize={11} color={level === 'none' ? 'faint' : 'secondaryInk'} numberOfLines={1}>
            {levelTag(level)}
          </PlainText>
        )}
      </YStack>
    </XStack>
  );
}
