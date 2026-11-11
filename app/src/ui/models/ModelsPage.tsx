import { useEffect } from 'react';
import { useAppStore } from '../../state/app';
import { useModelsStore } from '../../state/models';
import PageHeader from '../common/PageHeader';
import Screen from '../common/Screen';
import Note from '../env/parts/Note';
import { HONEST_NOTE } from './logic/modelText';
import HfToken from './sections/HfToken';
import InProgress from './sections/InProgress';
import OnPhone from './sections/OnPhone';
import Search from './sections/Search';
import Suggested from './sections/Suggested';

// Local models: what runs or waits, the models on the phone, our
// suggestions, any GGUF model on Hugging Face, and the token for gated
// ones. An agent picks one on its own model page.
export default function ModelsPage() {
  const push = useAppStore((s) => s.push);
  const device = useModelsStore((s) => s.device);

  useEffect(() => {
    useModelsStore.getState().hydrateModels();
  }, []);

  return (
    <Screen>
      <PageHeader kicker="on this phone" title="Models" />
      <Note>
        Models that run on this phone itself: no account or API key needed. An agent that can use one picks it on its
        page, under Model.
      </Note>
      {device.supported ? (
        <Note>{HONEST_NOTE}</Note>
      ) : (
        <Note tone="error">{`This phone can't run local models: ${device.reason ?? 'unknown reason'}.`}</Note>
      )}
      <InProgress />
      <OnPhone />
      <Suggested />
      <Search onOpen={(repo) => push({ name: 'model-repo', repo })} />
      <HfToken />
    </Screen>
  );
}
