import { designOf } from '../../../../../../mascot/designs.ts';
import { useAppStore } from '../../../../state/app';
import { useAgentLook } from '../../../common/face/useAgentLook';
import LinkRow from '../../../common/LinkRow';
import { MASCOT_TITLE } from './copy';

// The agent page's Mascot row: the design it wears, and its page.
export default function MascotRow({ agentId }: { agentId: string }) {
  const push = useAppStore((s) => s.push);
  const { mascot } = useAgentLook(agentId);
  return (
    <LinkRow
      label={MASCOT_TITLE}
      detail={designOf(mascot.design)?.name}
      onPress={() => push({ name: 'agent-mascot', agentId })}
    />
  );
}
