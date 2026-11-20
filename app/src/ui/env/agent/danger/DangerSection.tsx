import type { Agent } from '../../../../engine/agents/records';
import type { Env, Image } from '../../../../engine/linux/types';
import ActionDeck from '../../../common/actions/ActionDeck';
import { DANGER_DECK_TITLE } from '../../../common/actions/copy';
import { useDeleteKey } from './useDeleteKey';
import { useResetKey } from './useResetKey';

type Props = { agent: Agent; image: Image | undefined; env: Env | undefined; linux: boolean };

// The agent page's last box, the Danger zone: Reset (a Linux machine whose
// env is still there: an Android one has no system of its own, and a reset
// copies the env's base) and Delete, both in hazard tape, each behind a
// confirm that says exactly what goes and what stays. Their notes and the
// reinstall offer show under the box.
export default function DangerSection({ agent, image, env, linux }: Props) {
  const reset = useResetKey(agent, linux && image && env ? { image, env } : null);
  const remove = useDeleteKey(agent, image);
  return (
    <>
      <ActionDeck title={DANGER_DECK_TITLE} barcode="deckDanger" actions={[reset.action, remove.action]} />
      {reset.below}
      {remove.below}
    </>
  );
}
