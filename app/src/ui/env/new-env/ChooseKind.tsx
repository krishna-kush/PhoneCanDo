import { useState } from 'react';
import { createDefaultAgent } from '../../../state/flows/createAgentFromEnv';
import AppCard from '../../common/AppCard';
import Screen from '../../common/Screen';
import { linuxFailureText } from '../logic/errorText';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';
import ProgressBar from '../parts/ProgressBar';

// New env, step 1. Default is instant (the env ships in the app; only a new
// machine is made); Own goes on to pick an OS and a version to download.
export default function ChooseKind() {
  const open = useEnvNav((s) => s.open);
  const back = useEnvNav((s) => s.back);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickDefault = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    createDefaultAgent()
      .then((agent) => open({ name: 'agent', agentId: agent.id }))
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(false));
  };

  return (
    <Screen>
      <PageHeader title="New env" onBack={back} />
      <Note>Pick the base system for a new agent. The agent gets its own machine made from it.</Note>
      <AppCard
        title="Default"
        subtitle="Debian-based · ready in about half a minute, no download"
        onPress={pickDefault}
      />
      <AppCard
        title="Own"
        subtitle="Any Docker image: Alpine, Ubuntu, Fedora, Arch, Kali…"
        onPress={() => open({ name: 'new-env-os' })}
      />
      {busy ? <ProgressBar label="Making a new agent" fraction={null} /> : null}
      {error ? <Note tone="error">{error}</Note> : null}
      <Note>Not a security sandbox: what runs in a machine can reach the network and this app's files.</Note>
    </Screen>
  );
}
