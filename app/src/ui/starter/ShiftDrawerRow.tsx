import { useAppStore } from '../../state/app';
import { progress, shows } from '../../state/logic/starter/shift';
import { useStarterStore } from '../../state/starter';
import LinkRow from '../common/LinkRow';
import { rowDetail, SHIFT_TITLE } from './copy';
import { useShiftMissions } from './useShiftMissions';

// The drawer's First shift row, with how far along it is: there while the
// shift runs, until its finale (the Home card goes with the keyboard; this
// stays).
export default function ShiftDrawerRow({ reach }: { reach: { x: number; y: number } }) {
  const push = useAppStore((s) => s.push);
  const shift = useStarterStore((s) => s.shift);
  const { missions } = useShiftMissions();
  if (!shows(shift)) return null;
  const p = progress(shift, missions);
  return (
    <LinkRow label={SHIFT_TITLE} detail={rowDetail(p.done, p.total)} onPress={() => push({ name: 'starter' })} reach={reach} />
  );
}
