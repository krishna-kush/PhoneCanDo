import { Portal } from 'tamagui';
import { useStarterStore } from '../../../state/starter';
import { useShiftMissions } from '../useShiftMissions';
import { useWalkView } from './useWalkView';
import WalkLayer from './WalkLayer';

/**
 * The guide's layer among the app's floating ones (menus, dialogs): under
 * them, so a dialog that opens on the way is never covered; over menus
 * (under dialogs, which stack from 100000) while it points into one.
 */
const UNDER = 0;
const OVER_MENUS = 50000;

// Lead the way, over everything: mounted once in App, it draws nothing
// until a mission's walk is on (state/starter.ts), then the guide
// (WalkLayer) in Tamagui's root portal, so it lies over pages, the drawer
// and Home's ⋮ menu alike. With no walk it watches nothing else, so pages,
// the keyboard and spots coming and going never wake it.
export default function WalkGuide() {
  const on = useStarterStore((s) => s.walk != null);
  return on ? <Walking /> : null;
}

function Walking() {
  const view = useWalkView();
  const { ctx } = useShiftMissions();
  if (view.kind === 'none') return null;
  const overMenus = view.kind === 'step' && view.step.floats === true;
  return (
    <Portal zIndex={overMenus ? OVER_MENUS : UNDER}>
      <WalkLayer view={view} ctx={ctx} />
    </Portal>
  );
}
