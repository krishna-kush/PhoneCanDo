import OsLogo from '../parts/OsLogo';
import { useSystemLogo } from './useSystemLogo';

type Props = {
  /** The names its logo may be filed under (logic/osLogo.ts). */
  keys: readonly string[];
  /** The logo's side, in dp. */
  size: number;
};

// What a system's plate holds: its OS's Docker Hub logo, else the root's
// slash, never its letter. The plate is the caller's. Used by New agent's
// Where does it run?.
export default function SystemLogo({ keys, size }: Props) {
  return <OsLogo uri={useSystemLogo(keys)} size={size} />;
}
