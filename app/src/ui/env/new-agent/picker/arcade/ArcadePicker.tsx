import { useState } from 'react';
import { YStack } from 'tamagui';
import type { PickerProps } from '../props';
import PortraitGrid from './PortraitGrid';
import Showcase from './Showcase';
import SittingOutNote from './SittingOutNote';
import VsPlate from './vs/VsPlate';

// The arcade look: a fighting game's character select. The picked
// applicant stands big in the showcase with its stats, the rest wait in a
// grid of portraits under it (the picked one framed, a coin in the corner
// of each that plays free, which the stat key at the page's foot
// explains); who can't work here stays in the grid, asleep and dimmed, and
// the note under it says why. The showcase's VS sticker, or a hold on any
// portrait, brings a challenger in: the showcase turns into the VS plate,
// the pick against a challenger that a tap in the grid changes, until
// picking the challenger swaps them or Leave VS ends it.
export default function ArcadePicker({ offers, selected, onSelect, looks }: PickerProps) {
  const [challenger, setChallenger] = useState<string | null>(null);
  const pickable = offers.filter((o) => o.blocked == null);
  const picked = pickable.find((o) => o.id === selected) ?? null;
  const rival = picked ? (pickable.find((o) => o.id === challenger && o.id !== picked.id) ?? null) : null;
  const firstRival = picked ? (pickable.find((o) => o.id !== picked.id) ?? null) : null;
  return (
    <YStack gap="4">
      {picked && rival ? (
        <VsPlate
          pick={picked}
          challenger={rival}
          looks={looks}
          onPickChallenger={() => {
            setChallenger(picked.id);
            onSelect(rival.id);
          }}
          onLeave={() => setChallenger(null)}
        />
      ) : picked ? (
        <Showcase
          offer={picked}
          look={looks[picked.id]}
          onChallenge={firstRival ? () => setChallenger(firstRival.id) : undefined}
        />
      ) : null}
      <PortraitGrid
        offers={offers}
        selected={selected}
        challenger={rival?.id ?? null}
        onSelect={rival ? setChallenger : onSelect}
        onChallenge={setChallenger}
        looks={looks}
      />
      <SittingOutNote offers={offers} />
    </YStack>
  );
}
