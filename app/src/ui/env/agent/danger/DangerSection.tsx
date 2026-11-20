import type { Agent } from '../../../../engine/agents/records';
import type { Image } from '../../../../engine/linux/types';
import ActionDeck from '../../../common/actions/ActionDeck';
import { DANGER_DECK_TITLE } from '../../../common/actions/copy';
import { useDeleteKey } from './useDeleteKey';

type Props = { agent: Agent; image: Image | undefined };

// The agent page's last box, the Danger zone: Delete, in hazard tape,
// behind a confirm that says exactly what goes and what stays. Its notes
// show under the box. Reset is the machine's, on its Machine page.
export default function DangerSection({ agent, image }: Props) {
  const remove = useDeleteKey(agent, image);
  return (
    <>
      <ActionDeck title={DANGER_DECK_TITLE} barcode="deckDanger" actions={[remove.action]} />
      {remove.below}
    </>
  );
}
