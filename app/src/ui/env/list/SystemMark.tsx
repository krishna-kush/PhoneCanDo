import Svg, { Line, Rect } from 'react-native-svg';
import type { Env } from '../../../engine/linux/types';
import { useTheme } from '../../common/globals';
import { logoKeys } from '../logic/osLogo';
import OsLogo from '../parts/OsLogo';
import { useSystemLogo } from './useSystemLogo';

// What stands for a system, never a letter in a box: its OS's Docker Hub
// logo; Android (no Linux) a phone's outline; else the root's slash ("?"
// for machines we can't place).
export default function SystemMark({ env, size }: { env: Pick<Env, 'source' | 'os'> | null; size: number }) {
  const logo = useSystemLogo(env ? logoKeys(env) : []);
  if (!logo && env?.source.kind === 'android') return <PhoneGlyph size={size} />;
  return <OsLogo uri={logo} size={size} fallback={env ? '/' : '?'} />;
}

// A phone, front on: its body and a speaker slot, in amber ink.
function PhoneGlyph({ size }: { size: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6.5} y={2.5} width={11} height={19} stroke={t.secondaryInk} strokeWidth={1.4} fill="none" />
      <Line x1={10.5} x2={13.5} y1={5.5} y2={5.5} stroke={t.secondaryInk} strokeWidth={1.4} />
      <Line x1={11} x2={13} y1={18.5} y2={18.5} stroke={t.secondaryInk} strokeWidth={1.4} />
    </Svg>
  );
}
