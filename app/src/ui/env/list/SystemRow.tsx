import { XStack, YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';
import PlainText from '../../common/PlainText';
import OpenRow from '../../common/rows/OpenRow';
import type { EnvRow } from '../logic/sections';
import { systemAgentsLine } from '../logic/systemAgents';
import { envSubtitle, envTitle } from '../logic/titles';
import SystemDownload from './SystemDownload';
import SystemMark from './SystemMark';

type Props = { env: Env | null; rows: EnvRow<Image, Agent>[]; onOpen: () => void };

// The logo's side: big enough to tell systems apart at a glance.
const LOGO = 40;

// One system, a row of the key opening its page (an OpenRow): its mark
// (the OS's logo, unboxed), its name, OS and size (red once its download
// stopped) and its agents in amber capitals, then its download's bar while
// it comes in.
export default function SystemRow({ env, rows, onOpen }: Props) {
  const title = env ? envTitle(env.source) : "Machines we can't place";
  const sub = env ? envSubtitle(env) : 'Their system or machine is missing';
  const count = systemAgentsLine(rows);
  const failed = env?.state === 'failed';
  return (
    <OpenRow label={`${title}, ${sub}, ${count}`} onPress={onOpen}>
      <YStack gap="2">
        <XStack alignItems="center" gap="3">
          <SystemMark env={env} size={LOGO} />
          <YStack flex={1} minWidth={0} gap={2}>
            <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
              {title}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={12} color={failed ? 'primary' : 'dim'} numberOfLines={1}>
              {sub}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
              {count}
            </PlainText>
          </YStack>
        </XStack>
        {env?.state === 'downloading' ? <SystemDownload env={env} /> : null}
      </YStack>
    </OpenRow>
  );
}
