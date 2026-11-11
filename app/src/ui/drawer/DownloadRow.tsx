import type { Env } from '../../engine/linux/types';
import { useTargetProgress } from '../../state/linux';
import { progressLine } from '../env/logic/steps';
import { envTitle } from '../env/logic/titles';
import LinkRow from '../common/LinkRow';

// An Own env still downloading: its first agent comes once it is done, so
// it shows here with the agents. Opens its system page, where it can be
// followed or cancelled.
export default function DownloadRow({ env, onOpen }: { env: Env; onOpen: () => void }) {
  const progress = useTargetProgress({ kind: 'env', id: env.id });
  const detail = progress ? progressLine(progress.step, progress.done, progress.total) : 'Downloading';
  return <LinkRow label={envTitle(env.source)} detail={detail} onPress={onOpen} />;
}
