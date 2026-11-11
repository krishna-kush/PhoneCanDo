import { useCallback, useEffect, useState } from 'react';
import { repoModels, toModelError } from '../../engine/models/native';
import type { ModelDates, RepoModels } from '../../engine/models/types';
import { download } from '../../state/flows/modelActions';
import { useModelsStore } from '../../state/models';
import AppButton from '../common/AppButton';
import PageHeader from '../common/PageHeader';
import Screen from '../common/Screen';
import Note from '../env/parts/Note';
import { useSlidInList } from '../nav/slidIn';
import ProgressBar from '../env/parts/ProgressBar';
import { modelErrorText } from './logic/errorText';
import { variantFiles, variantLine, variantTitle } from './logic/modelText';
import DatesLine from './parts/DatesLine';
import ModelPanel from './parts/ModelPanel';
import { useAction } from './useAction';

// Panels drawn as the page opens; the rest come once it has slid in.
const FIRST_SCREEN_PANELS = 3;

// One Hugging Face repository's models at its latest commit, smallest
// first, each with its size and verdict (its files alone: the context's
// memory is known once it is on the phone), under the original model's
// dates. Download pins that commit and keeps the dates with the model.
export default function RepoPage({ repo }: { repo: string }) {
  const [models, setModels] = useState<RepoModels | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Re-read on a change, so a started download shows as one.
  const changes = useModelsStore((s) => s.downloads.length + s.models.length);

  const load = useCallback(() => {
    setError(null);
    repoModels(repo)
      .then(setModels)
      .catch((e: unknown) => {
        const err = toModelError(e);
        setError(modelErrorText(err.code, err.message));
      });
  }, [repo]);

  useEffect(load, [load, changes]);
  const variants = useSlidInList(models?.variants ?? [], FIRST_SCREEN_PANELS);

  return (
    <Screen>
      <PageHeader kicker="models · hugging face" title={repo} />
      {error ? (
        <>
          <Note tone="error">{error}</Note>
          <AppButton variant="secondary" onPress={load}>
            Try again
          </AppButton>
        </>
      ) : models == null ? (
        <ProgressBar label="Reading the repository" fraction={null} />
      ) : (
        <>
          <DatesLine dates={models.dates} />
          {models.gated ? <Note>Gated: accept its terms on huggingface.co and save a token from that account first.</Note> : null}
          {models.variants.length === 0 ? <Note>No GGUF model we can run in this repository.</Note> : null}
          {variants.map((v) => (
            <VariantPanel
              key={v.files[0]?.path ?? variantTitle(v)}
              repo={models.repo}
              revision={models.revision}
              dates={models.dates}
              variant={v}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

type VariantProps = { repo: string; revision: string; dates: ModelDates | null; variant: RepoModels['variants'][number] };

function VariantPanel({ repo, revision, dates, variant }: VariantProps) {
  const action = useAction();
  const runs = variant.ram.verdict === 'fits' || variant.ram.verdict === 'tight';
  return (
    <ModelPanel title={variantTitle(variant)} lines={[variantLine(variant)]} files={variantFiles(variant)} ram={variant.ram}>
      {variant.onPhone ? (
        <Note>On this phone.</Note>
      ) : variant.downloadId ? (
        <Note>Downloading: see In progress on the Models page.</Note>
      ) : (
        <AppButton loading={action.busy} disabled={!runs} onPress={() => void action.run(() => download(repo, revision, variant.files, dates))}>
          Download
        </AppButton>
      )}
      {action.error ? <Note tone="error">{action.error}</Note> : null}
    </ModelPanel>
  );
}
