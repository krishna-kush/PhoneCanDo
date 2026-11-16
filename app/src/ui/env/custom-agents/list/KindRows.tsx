import { XStack, YStack } from 'tamagui';
import CardMenu from '../../../common/CardMenu';
import StillFace from '../../../common/face/StillFace';
import PlainText from '../../../common/PlainText';
import RowFrame from '../../../common/rows/RowFrame';
import RowGroup from '../../../common/rows/RowGroup';
import { kindLine } from '../../logic/customAgentText';
import { kindLook } from '../logic/kindLook';
import type { KindItem } from './item';

// The kinds as one figure key: each a row with its mascot's face, its name,
// its id and who uses it (why it does not load, in red), and ⋮ for its
// actions; a tap opens its form.
export default function KindRows({ items }: { items: KindItem[] }) {
  return (
    <RowGroup title="Your agents" barcode="customKinds">
      {items.map((item) => (
        <KindRow key={item.kind.id} item={item} />
      ))}
    </RowGroup>
  );
}

function KindRow({ item }: { item: KindItem }) {
  const { kind, label, agents, menu, onEdit } = item;
  const problem = kind.problem?.detail ?? null;
  const line = kindLine(kind.id, problem, agents);
  return (
    <RowFrame press={onEdit ? { onPress: onEdit, role: 'button', label: `${label}, ${line}`, hint: 'Opens its form' } : undefined}>
      <XStack alignItems="center" gap="3">
        <StillFace mood={problem ? 'oops' : 'awake'} mascot={kindLook(kind.id)} size={18} />
        <YStack flex={1} minWidth={0} gap={2}>
          <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
            {label}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={12} color={problem ? 'primary' : 'dim'} numberOfLines={2}>
            {line}
          </PlainText>
        </YStack>
        <YStack marginVertical={-8} marginRight={-12}>
          <CardMenu items={menu} label={`Actions for ${label}`} />
        </YStack>
      </XStack>
    </RowFrame>
  );
}
