import { useEffect } from 'react';
import { useModelsStore } from '../../state/models';
import Screen from '../common/Screen';
import { useEnvNav } from '../env/nav';
import Note from '../env/parts/Note';
import PageHeader from '../env/parts/PageHeader';
import { HONEST_NOTE } from './logic/modelText';
import HfToken from './sections/HfToken';
import InProgress from './sections/InProgress';
import OnPhone from './sections/OnPhone';
import Search from './sections/Search';
import Suggested from './sections/Suggested';

// Local models: what runs or waits, the models on the phone, our
// suggestions, any GGUF model on Hugging Face, and the token for gated
// ones. An agent picks one on its own page (Model). [agentId]: opened from
// that agent's page, where Back returns.
export default function ModelsPage({ agentId }: { agentId?: string }) {
  const back = useEnvNav((s) => s.back);
  const open = useEnvNav((s) => s.open);
  const device = useModelsStore((s) => s.device);

  useEffect(() => {
    useModelsStore.getState().hydrateModels();
  }, []);

  return (
    <Screen>
      <PageHeader title="Models" onBack={back} />
      <Note>
        Models that run on this phone itself: no account or API key needed. An agent that can use one picks it on its
        own page.
      </Note>
      {device.supported ? (
        <Note>{HONEST_NOTE}</Note>
      ) : (
        <Note tone="error">{`This phone can't run local models: ${device.reason ?? 'unknown reason'}.`}</Note>
      )}
      <InProgress />
      <OnPhone />
      <Suggested />
      <Search onOpen={(repo) => open({ name: 'model-repo', repo, agentId })} />
      <HfToken />
    </Screen>
  );
}
