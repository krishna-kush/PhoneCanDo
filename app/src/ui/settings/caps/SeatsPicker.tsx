import { useState } from 'react';
import { YStack } from 'tamagui';
import Bench from '../../common/bench/Bench';
import Place from '../../common/bench/Place';
import AgentFace from '../../common/face/AgentFace';
import StillFace from '../../common/face/StillFace';
import PlainText from '../../common/PlainText';
import { usePageActive } from '../../nav/pageActive';
import { capName, type Cap, type CapKind } from '../logic/caps';
import CapCaption from './CapCaption';
import { seatLook } from './logic/crew';
import { capPlaces, inCap } from './logic/places';
import Cartridge from './Cartridge';

// A face's short side on the bench.
const FACE = 20;

type Props = {
  kind: CapKind;
  value: Cap;
  onPick: (cap: Cap) => void;
  disabled: boolean;
};

// One cap as a bench: ∞ first (no cap: everyone gets a seat), then a seat
// per number. Agents sit on it as A-series units, each in its own design;
// models are cartridges in a rack. Tap the k-th seat to cap at k: seats up
// to it light up and their units wake (the one in the cap's own seat hops),
// the rest doze, faded; a cartridge outside the cap lifts out of its slot.
// Under it, the cap's name and what it does.
export default function SeatsPicker({ kind, value, onPick, disabled }: Props) {
  const [hop, setHop] = useState(0);
  const active = usePageActive();
  const pick = (cap: Cap) => {
    setHop((n) => n + 1);
    onPick(cap);
  };

  const art = (n: number) => {
    const lit = inCap(n, value);
    if (kind === 'models') return <Cartridge lit={lit} />;
    if (n === value) return <AgentFace mood="awake" size={FACE} mascot={seatLook(n)} hop={hop} still={!active} />;
    return (
      <YStack opacity={lit ? 1 : 0.35}>
        <StillFace mood={lit ? 'awake' : 'asleep'} size={FACE} mascot={seatLook(n)} />
      </YStack>
    );
  };

  return (
    <YStack gap="2">
      <Bench
        at={value == null ? 0 : value}
        first={
          <Place
            label="all"
            lit={value == null}
            picked={value == null}
            disabled={disabled}
            onPress={() => pick(null)}
            a11y={`No cap, ${capName(kind, null)}`}
          >
            <PlainText fontFamily="mono" fontSize={24} fontWeight="600" color={value == null ? 'primary' : 'dim'}>
              ∞
            </PlainText>
          </Place>
        }
      >
        {capPlaces(kind, value).map((n) => (
          <Place
            key={n}
            label={String(n)}
            lit={inCap(n, value)}
            picked={n === value}
            disabled={disabled}
            onPress={() => pick(n)}
            a11y={`${n}, ${capName(kind, n)}`}
          >
            {art(n)}
          </Place>
        ))}
      </Bench>
      <CapCaption kind={kind} value={value} />
    </YStack>
  );
}
