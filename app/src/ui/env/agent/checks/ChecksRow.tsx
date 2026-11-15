import { useAppStore } from '../../../../state/app';
import LinkRow from '../../../common/LinkRow';
import { checksSummary, CHECKS_TITLE } from './logic/copy';
import { useWatchedChecks } from './useWatchedChecks';

// The agent's "What it can do" in its Settings block: how many of the
// things it is set up to do we have seen work ("4 checked · 1 not
// working", red while one isn't), opening its page. Nothing on a build
// without checks.
export default function ChecksRow({ agentId }: { agentId: string }) {
  const push = useAppStore((s) => s.push);
  const checks = useWatchedChecks(agentId);
  if (!checks) return null;
  const summary = checksSummary(checks);
  return (
    <LinkRow
      label={CHECKS_TITLE}
      detail={summary.text}
      alert={summary.alert}
      onPress={() => push({ name: 'agent-checks', agentId })}
    />
  );
}
