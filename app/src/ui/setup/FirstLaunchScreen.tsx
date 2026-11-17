import { useEffect, useRef } from 'react';
import { YStack } from 'tamagui';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import Screen from '../common/Screen';
import { stepLabel } from '../env/logic/steps';
import { setupNote, setupTitle } from './copy';
import { FINALE_MS, stageOf } from './logic/stage';
import SetupBody from './SetupBody';
import { useFirstLaunch } from './useFirstLaunch';
import { useSetupProgress } from './useSetupProgress';

/** The status line at the finale. */
const READY = 'Ready';

// Shown by App while no agent exists, and for the finale once the first
// one does: sets up the first agent (the default kind, never asked) and
// its machine (Default env, offline, about half a minute), or the Android
// path where Linux is unavailable, as an arcade's loading screen with
// the agent running to the flag (arcade/). Once the agent exists the finale plays
// for FINALE_MS, then [onFinished] lets App show Home. A failure says
// why, with Retry and, on the Linux path, Continue without Linux.
export default function FirstLaunchScreen({ onFinished }: { onFinished: () => void }) {
  const { ctx, imageId, phase, look, kindId, retry, skipLinux } = useFirstLaunch();
  const progress = useSetupProgress(imageId);
  const made = useAgentsStore((s) => s.agents.length > 0);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    if (!made) return;
    const t = setTimeout(() => finished.current(), FINALE_MS);
    return () => clearTimeout(t);
  }, [made]);

  const linux = ctx.path === 'linux';
  const failed = phase.kind === 'failed' && !made;
  const where = progress.failedStep ? `Setup stopped while ${stepLabel(progress.failedStep).toLowerCase()}. ` : '';

  return (
    <Screen pillClearance={false}>
      <YStack flex={1} justifyContent="center" paddingVertical="6">
        <SetupBody
          title={setupTitle(ctx)}
          note={setupNote(ctx)}
          scene={{
            state: {
              stage: stageOf(ctx.path, progress.phase, progress.imageReady),
              fraction: progress.fraction,
              done: made,
              failed,
            },
            mascot: look,
            agentName: kindId ? agentKind(kindId).label : '',
            label: made ? READY : progress.label,
          }}
          failure={
            phase.kind === 'failed' && !made
              ? { text: `${where}${phase.reason}`, onRetry: retry, onSkip: linux ? skipLinux : null }
              : undefined
          }
        />
      </YStack>
    </Screen>
  );
}
