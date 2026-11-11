import { useModelsStore } from '../../../state/models';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import SectionTitle from '../../common/SectionTitle';
import Note from '../../env/parts/Note';
import CapPicker from '../caps/CapPicker';
import RamGuardSection from '../../memory/RamGuardSection';
import { useRunLimits } from '../caps/useRunLimits';
import { pageKicker } from '../logic/hub';

// Settings → Agents & models: the caps on what runs at once, none unless
// the user picks one (the models' cap only on a phone that runs local
// models), then the RAM guard, which watches whatever the caps say.
export default function AgentsPage() {
  const { limits, save, supported, failed } = useRunLimits();
  const modelsOffered = useModelsStore((s) => s.device.supported);
  return (
    <Screen>
      <PageHeader kicker={pageKicker('agents')} title="Agents & models" />
      <Note>
        {"By default there's no cap: run as many agents and local models as your phone can hold. Want a ceiling anyway? Pick one here."}
      </Note>
      {supported ? null : <Note tone="error">{"This build can't keep caps yet. Update the app to set them."}</Note>}
      <SectionTitle>Agents at once</SectionTitle>
      <CapPicker
        kind="agents"
        value={limits.maxAgents}
        disabled={!supported}
        onPick={(maxAgents) => save({ ...limits, maxAgents })}
      />
      {modelsOffered ? (
        <>
          <SectionTitle>Local models at once</SectionTitle>
          <CapPicker
            kind="models"
            value={limits.maxModels}
            disabled={!supported}
            onPick={(maxModels) => save({ ...limits, maxModels })}
          />
        </>
      ) : null}
      {failed ? <Note tone="error">{"That didn't save. Try again."}</Note> : null}
      <RamGuardSection />
    </Screen>
  );
}
