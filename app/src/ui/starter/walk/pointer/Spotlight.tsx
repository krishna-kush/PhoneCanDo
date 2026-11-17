import type { PointerProps } from './pointerProps';
import Ticks from './Ticks';
import Torch from './Torch';

// What points at the thing to tap: the screen dims but for a hole around
// it (Torch), and the field manual's four ticks and FIG tag frame it
// inside the light (Ticks). The ticks sit closer in than the hole's edge,
// flying in and breathing with it, so they stay lit.
export default function Spotlight(props: PointerProps) {
  return (
    <>
      <Torch {...props} />
      <Ticks {...props} />
    </>
  );
}
