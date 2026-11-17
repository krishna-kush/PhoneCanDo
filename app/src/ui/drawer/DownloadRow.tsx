import type { Env } from '../../engine/linux/types';
import { useTargetProgress } from '../../state/linux';
import { downloadLine } from '../env/logic/steps';
import { envTitle, isPaused } from '../env/logic/titles';
import LinkRow from '../common/LinkRow';

// An Own env still downloading, or paused: its first agent comes once it
// is done, so it shows here with the agents. Opens its system page, where
// it can be followed, paused or resumed.
export default function DownloadRow({ env, onOpen }: { env: Env; onOpen: () => void }) {
  const progress = useTargetProgress({ kind: 'env', id: env.id });
  const detail = isPaused(env) ? 'Paused · open it to resume' : progress ? downloadLine(progress) : 'Downloading';
  return <LinkRow label={envTitle(env.source)} detail={detail} onPress={onOpen} />;
}
