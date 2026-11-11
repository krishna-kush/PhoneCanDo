import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import { formatBytes } from '../logic/format';
import { missingToolsLine } from '../logic/hints';
import { envTitle, osLine } from '../logic/titles';
import ImageStatus from '../parts/ImageStatus';
import Note from '../parts/Note';
import { useMissingTools } from './useMissingTools';

type Props = { agent: Agent; image: Image | undefined; env: Env | undefined; linux: boolean };

// The agent's machine page body: which env it comes from, the detected OS,
// its size, its setup state, commands the agent's kind needs but the
// machine lacks (checked when the page shows it, with the install command
// typed into a terminal, not run), and the plain truths: not a sandbox, no
// systemd.
export default function MachineSection({ agent, image, env, linux }: Props) {
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const tools = useMissingTools(agent, image, linux);

  if (!image) {
    return (
      <Note tone="error">Its machine is missing. Delete this agent and make a new one.</Note>
    );
  }

  const os = linux ? osLine(image.os ?? env?.os ?? null) : "Android's own shell";
  const size = image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const missing = tools?.missingTools ?? [];
  const install = tools?.installCommand ?? null;

  return (
    <>
      <AppCard
        title={env ? envTitle(env.source) : 'Unknown env'}
        subtitle={[os, size].filter(Boolean).join(' · ') || undefined}
        chevron={false}
      />
      <ImageStatus image={image} />
      {missing.length > 0 ? (
        <>
          <Note>{missingToolsLine(missing)}</Note>
          {install ? (
            <>
              <AppButton variant="secondary" onPress={() => openLinuxTerminal(agent.id, install)}>
                Open terminal with the install command
              </AppButton>
              <Note>The command is typed in for you; press Enter to run it.</Note>
            </>
          ) : (
            <Note>We don't know its package manager, so install them by hand in a terminal.</Note>
          )}
        </>
      ) : null}
      {linux ? (
        <>
          <Note>Not a security sandbox: what runs here can reach the network and this app's files.</Note>
          <Note>systemd doesn't run here, so start services by hand.</Note>
        </>
      ) : null}
    </>
  );
}
