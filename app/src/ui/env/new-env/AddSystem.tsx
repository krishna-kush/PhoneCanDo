import { useAppStore } from '../../../state/app';
import AppCard from '../../common/AppCard';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Stamp from '../../common/Stamp';
import { DEFAULT_ENV_TITLE } from '../logic/titles';
import { useNewAgent } from '../new-agent/useNewAgent';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';

// Add system while the Default system is gone (it was deleted): bring it
// back (instant, in the app; made with its first agent, after Choose agent
// when there is a choice), or download a Linux.
export default function AddSystem() {
  const push = useAppStore((s) => s.push);
  const newAgent = useNewAgent();

  return (
    <Screen>
      <PageHeader kicker="add system" title="Which system?" />
      <Note>A system is a base OS; each agent on it gets its own machine. It comes with its first agent.</Note>
      <AppCard
        title={DEFAULT_ENV_TITLE}
        subtitle="Debian-based · ready in about half a minute, no download"
        onPress={newAgent.busy ? undefined : () => newAgent.start({ kind: 'default' })}
      >
        <Stamp>recommended</Stamp>
      </AppCard>
      <AppCard
        title="Download a Linux"
        subtitle="Any Docker image: Alpine, Ubuntu, Fedora, Arch, Kali…"
        onPress={() => push({ name: 'new-env-os' })}
      />
      {newAgent.busy ? <ProgressBar label="Making a new agent" fraction={null} /> : null}
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <Note>Not a security sandbox: what runs in a machine can reach the network and this app's files.</Note>
    </Screen>
  );
}
