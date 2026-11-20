import type { Agent } from '../../../../engine/agents/records';
import type { Env, Image } from '../../../../engine/linux/types';
import ActionDeck from '../../../common/actions/ActionDeck';
import { DANGER_DECK_TITLE } from '../../../common/actions/copy';
import Note from '../../parts/Note';
import { NO_RESET_NOTE } from '../logic/copy';
import { useResetKey } from './useResetKey';

type Props = { agent: Agent; image: Image; env: Env | undefined };

// The machine page's last box for a Linux machine, its Danger zone: Reset
// machine, in hazard tape, behind a confirm that says what goes and what
// stays, its notes and the reinstall offer under the box. A machine whose
// env is gone can't be reset (a reset copies the env's base), and says so.
export default function ResetSection({ agent, image, env }: Props) {
  const reset = useResetKey(agent, env ? { image, env } : null);
  if (!reset.action) return <Note>{NO_RESET_NOTE}</Note>;
  return (
    <>
      <ActionDeck title={DANGER_DECK_TITLE} barcode="deckMachineDanger" actions={[reset.action]} />
      {reset.below}
    </>
  );
}
