import { YStack } from 'tamagui';
import SittingOutNote from './SittingOutNote';
import type { PickerProps } from '../props';
import PortraitGrid from './PortraitGrid';
import Showcase from './Showcase';

// The arcade look: a fighting game's character select. The picked
// applicant stands big in the showcase with its stats, the rest wait in a
// grid of portraits under it (the picked one framed, its P1 flag
// blinking); who can't work here stays in the grid, asleep and dimmed,
// and the note under it says why.
export default function ArcadePicker({ offers, selected, onSelect, looks }: PickerProps) {
  const picked = offers.find((o) => o.id === selected && o.blocked == null) ?? null;
  return (
    <YStack gap="4">
      {picked ? <Showcase offer={picked} look={looks[picked.id]} /> : null}
      <PortraitGrid offers={offers} selected={selected} onSelect={onSelect} looks={looks} />
      <SittingOutNote offers={offers} />
    </YStack>
  );
}
