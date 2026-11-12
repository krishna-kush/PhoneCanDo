import { XStack, YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';
import { useTargetProgress } from '../../../state/linux';
import ChevronIcon from '../../common/ChevronIcon';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { logoKeys } from '../logic/osLogo';
import { agentCountOf, type EnvRow } from '../logic/sections';
import { downloadLine, stepFraction } from '../logic/steps';
import { envSubtitle, envTitle } from '../logic/titles';
import ProgressBar from '../parts/ProgressBar';
import SystemLogo from './SystemLogo';

type Props = { env: Env | null; rows: EnvRow<Image, Agent>[]; onOpen: () => void };

function agentsLine(rows: EnvRow<Image, Agent>[]): string {
  const agents = agentCountOf(rows);
  const settingUp = rows.filter((r) => r.image != null && r.image.state !== 'ready').length;
  const count = agents === 0 ? 'no agents' : agents === 1 ? '1 agent' : `${agents} agents`;
  return settingUp > 0 ? `${count} · ${settingUp} setting up` : count;
}

// One system in the Systems list: a plate with its OS's logo (Docker Hub's,
// as Which Linux? shows it; else its letter), its name, OS and size, and how
// many agents run on it; a download in progress shows its bar, a stopped one
// says so. Tap opens the system's page, where its agents are listed.
export default function SystemCard({ env, rows, onOpen }: Props) {
  const t = useTheme();
  const progress = useTargetProgress(env ? { kind: 'env', id: env.id } : null);
  const title = env ? envTitle(env.source) : "Machines we can't place";
  const sub = env ? envSubtitle(env) : 'Their system or machine is missing';
  const letter = (env?.os?.id ?? (env?.source.kind === 'android' ? 'android' : env ? title : '?')).charAt(0).toUpperCase();
  const count = agentsLine(rows);

  return (
    <YStack
      borderWidth={1}
      borderColor={env?.state === 'failed' ? 'primary' : 'line'}
      backgroundColor="panel press:panel2"
      padding="3"
      gap="3"
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}, ${count}`}
    >
      <XStack alignItems="center" gap="3">
        <YStack width={44} height={44} borderWidth={1} borderColor="lineStrong" alignItems="center" justifyContent="center" flexShrink={0}>
          <SystemLogo keys={env ? logoKeys(env) : []} letter={letter} size={28} />
        </YStack>
        <YStack flex={1} minWidth={0} gap={2}>
          <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
            {title}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={12} color={env?.state === 'failed' ? 'primary' : 'dim'} numberOfLines={1}>
            {sub}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
            {count}
          </PlainText>
        </YStack>
        <ChevronIcon size={14} color={t.faint} />
      </XStack>
      {env?.state === 'downloading' ? (
        <ProgressBar
          label={progress ? downloadLine(progress) : 'Downloading'}
          fraction={progress ? stepFraction(progress.step, progress.done, progress.total) : null}
        />
      ) : null}
    </YStack>
  );
}
