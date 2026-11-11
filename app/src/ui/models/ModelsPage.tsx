import { useEffect } from 'react';
import { useAppStore } from '../../state/app';
import { importJobs } from '../../state/flows/logic/modelProgress';
import { useModelsStore } from '../../state/models';
import PageHeader from '../common/PageHeader';
import Screen from '../common/Screen';
import Note from '../env/parts/Note';
import AfterSlide from '../nav/AfterSlide';
import { useSlidIn } from '../nav/slidIn';
import { HONEST_NOTE } from './logic/modelText';
import HfToken from './sections/HfToken';
import InProgress from './sections/InProgress';
import OnPhone from './sections/OnPhone';
import Search from './sections/Search';
import Suggested from './sections/Suggested';

// About as many model panels as fit under the notes on a phone's first
// screen. The lists draw that many when the page opens and the rest once it
// has slid in; Search and the token, further down, come then too unless
// short lists bring them up into the first screen.
const FIRST_SCREEN_PANELS = 3;

// Local models: what runs or waits, the models on the phone, our
// suggestions, any GGUF model on Hugging Face, and the token for gated
// ones. An agent picks one on its own model page.
export default function ModelsPage() {
  const push = useAppStore((s) => s.push);
  const device = useModelsStore((s) => s.device);
  const busy = useModelsStore((s) => s.downloads.length + importJobs(s.jobs).length);
  const onPhone = useModelsStore((s) => s.models.length);
  const suggested = useModelsStore((s) => s.suggested.length);
  const room = (above: number) => Math.max(0, FIRST_SCREEN_PANELS - above);
  const searchInView = room(busy + onPhone + suggested) > 0;
  const slidIn = useSlidIn();

  // Re-read once the page is in (the app read them at launch): on the tap,
  // the page would draw twice before its first frame (EnvList.tsx).
  useEffect(() => {
    if (slidIn) useModelsStore.getState().hydrateModels();
  }, [slidIn]);

  return (
    <Screen viewport>
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
      <OnPhone firstScreen={room(busy)} />
      <Suggested firstScreen={room(busy + onPhone)} />
      <AfterSlide now={searchInView}>
        <Search firstScreen={FIRST_SCREEN_PANELS} onOpen={(repo) => push({ name: 'model-repo', repo })} />
        <HfToken />
      </AfterSlide>
    </Screen>
  );
}
