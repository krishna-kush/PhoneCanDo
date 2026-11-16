import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';
import RowGroup from '../../common/rows/RowGroup';
import type { EnvSection } from '../logic/sections';
import SystemRow from './SystemRow';

type Props = {
  /** The systems drawn now (the rest come once the page is in). */
  systems: EnvSection<Env, Image, Agent>[];
  /** Every system, for the box's title. */
  total: number;
  onOpen: (envId: string | null) => void;
};

// The Systems list as the site's figure key: one box, a row per system.
export default function SystemRows({ systems, total, onOpen }: Props) {
  if (total === 0) return null;
  return (
    <RowGroup title={total === 1 ? '1 system' : `${total} systems`} barcode="systems">
      {systems.map((s) => (
        <SystemRow key={s.key} env={s.env} rows={s.rows} onOpen={() => onOpen(s.env?.id ?? null)} />
      ))}
    </RowGroup>
  );
}
