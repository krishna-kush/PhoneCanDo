import { XStack } from 'tamagui';
import type { ModelDownload, ModelProgress } from '../../../engine/models/types';
import { importJobs, lostDownloadJobs, modelJobKey } from '../../../state/flows/logic/modelProgress';
import { cancelJob, remove, resume } from '../../../state/flows/modelActions';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import SectionTitle from '../../common/SectionTitle';
import Note from '../../env/parts/Note';
import ProgressBar from '../../env/parts/ProgressBar';
import { modelErrorText } from '../logic/errorText';
import { fraction, jobLine } from '../logic/modelText';
import ModelPanel from '../parts/ModelPanel';
import { useAction } from '../useAction';

// Downloads that run or wait (a cancel, an app restart, a network that
// stayed down: Resume carries on from what arrived), downloads that failed
// with nothing left to resume, and imports that run or failed.
export default function InProgress() {
  const downloads = useModelsStore((s) => s.downloads);
  const jobs = useModelsStore((s) => s.jobs);
  const imports = importJobs(jobs);
  const lost = lostDownloadJobs(jobs, downloads.map((d) => d.id));
  if (downloads.length === 0 && imports.length === 0 && lost.length === 0) return null;
  return (
    <>
      <SectionTitle>In progress</SectionTitle>
      {downloads.map((d) => (
        <DownloadPanel key={d.id} download={d} job={jobs[modelJobKey({ kind: 'download', id: d.id })]} />
      ))}
      {lost.map((p) => (
        <JobPanel key={p.jobId} job={p} line="Downloaded, then removed" />
      ))}
      {imports.map((p) => (
        <JobPanel key={p.jobId} job={p} line="Copying from the phone" />
      ))}
    </>
  );
}

function DownloadPanel({ download, job }: { download: ModelDownload; job: ModelProgress | undefined }) {
  const action = useAction();
  const running = job ? !job.finished : download.jobId != null;
  const jobId = job && !job.finished ? job.jobId : download.jobId;
  const failure = job?.finished && job.errorCode && job.errorCode !== 'cancelled' ? job : null;
  const done = running && job ? job.done : download.doneBytes;
  const total = running && job ? job.total : download.sizeBytes;
  return (
    <ModelPanel title={download.name} lines={[download.repo]}>
      <ProgressBar
        label={running ? jobLine(job, null) || 'Starting' : jobLine(undefined, download)}
        fraction={fraction(done, total)}
      />
      {failure ? <Note tone="error">{modelErrorText(failure.errorCode ?? 'internal', failure.error ?? '')}</Note> : null}
      {action.error ? <Note tone="error">{action.error}</Note> : null}
      {running ? (
        <AppButton variant="secondary" onPress={() => jobId && cancelJob(jobId)} disabled={!jobId}>
          Pause
        </AppButton>
      ) : (
        <XStack gap="2">
          <AppButton flex={1} loading={action.busy} onPress={() => void action.run(() => resume(download.id))}>
            Resume
          </AppButton>
          <AppButton flex={1} variant="secondary" onPress={() => void action.run(() => remove(download.id))}>
            Delete
          </AppButton>
        </XStack>
      )}
    </ModelPanel>
  );
}

// A job with no download row: an import, or a download whose record went.
function JobPanel({ job, line }: { job: ModelProgress; line: string }) {
  const dismiss = useModelsStore((s) => s.dismissJob);
  const running = !job.finished;
  return (
    <ModelPanel title={job.label} lines={[line]}>
      <ProgressBar label={jobLine(running ? job : undefined, null) || 'Stopped'} fraction={fraction(job.done, job.total)} />
      {!running && job.errorCode ? <Note tone="error">{modelErrorText(job.errorCode, job.error ?? '')}</Note> : null}
      {running ? (
        <AppButton variant="secondary" onPress={() => cancelJob(job.jobId)}>
          Cancel
        </AppButton>
      ) : (
        <AppButton variant="secondary" onPress={() => dismiss(modelJobKey(job.target))}>
          Dismiss
        </AppButton>
      )}
    </ModelPanel>
  );
}
