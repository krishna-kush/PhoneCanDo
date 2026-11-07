import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';
import SectionTitle from '../../common/SectionTitle';
import DeleteBlock from './DeleteBlock';
import ResetBlock from './ResetBlock';

type Props = { agent: Agent; image: Image | undefined; env: Env | undefined; linux: boolean };

// Reset (a Linux machine whose env is still there: an Android one has no
// system of its own, and a reset copies the env's base) and Delete, each
// behind a confirm that says exactly what goes and what stays.
export default function DangerSection({ agent, image, env, linux }: Props) {
  const resettable = linux && image && env ? { image, env } : null;
  return (
    <>
      <SectionTitle>{resettable ? 'Reset or delete' : 'Delete'}</SectionTitle>
      {resettable ? <ResetBlock agent={agent} image={resettable.image} env={resettable.env} /> : null}
      <DeleteBlock agent={agent} image={image} />
    </>
  );
}
