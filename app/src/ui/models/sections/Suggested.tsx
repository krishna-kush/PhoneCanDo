import type { SuggestedModel } from '../../../engine/models/types';
import { download } from '../../../state/flows/modelActions';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import SectionTitle from '../../common/SectionTitle';
import { formatBytes } from '../../env/logic/format';
import Note from '../../env/parts/Note';
import { useSlidInList } from '../../nav/slidIn';
import ModelPanel from '../parts/ModelPanel';
import { useAction } from '../useAction';

// Our suggestions, best first, each with its verdict for this phone (files
// plus the context's memory). Search below stays open to any model.
// `firstScreen` panels draw as the page opens (ModelsPage.tsx).
export default function Suggested({ firstScreen }: { firstScreen: number }) {
  const suggested = useModelsStore((s) => s.suggested);
  const shown = useSlidInList(suggested, firstScreen);
  if (suggested.length === 0) return null;
  return (
    <>
      <SectionTitle>Suggested</SectionTitle>
      {shown.map((s) => (
        <SuggestedPanel key={`${s.repo}/${s.file.path}`} model={s} />
      ))}
    </>
  );
}

function SuggestedPanel({ model }: { model: SuggestedModel }) {
  const action = useAction();
  const runs = model.ram.verdict === 'fits' || model.ram.verdict === 'tight';
  return (
    <ModelPanel
      title={model.title}
      lines={[model.note, `${formatBytes(model.sizeBytes)} · ${model.repo}`]}
      dates={model.dates}
      ram={model.ram}
    >
      {model.onPhone ? (
        <Note>On this phone.</Note>
      ) : model.downloadId ? (
        <Note>Downloading: see In progress.</Note>
      ) : (
        <AppButton
          loading={action.busy}
          disabled={!runs}
          onPress={() => void action.run(() => download(model.repo, model.revision, [model.file], model.dates))}
        >
          {`Download ${formatBytes(model.sizeBytes)}`}
        </AppButton>
      )}
      {action.error ? <Note tone="error">{action.error}</Note> : null}
    </ModelPanel>
  );
}
