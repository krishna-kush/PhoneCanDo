import { installedVersion } from '../../engine/updates';
import { useAppStore } from '../../state/app';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import PlainText from '../common/PlainText';
import ThumbIcon from '../common/ThumbIcon';

function Thumb({ up }: { up: boolean }) {
  return <ThumbIcon up={up} size={26} />;
}

// Settings → Updates, the body of its page (pages/UpdatesPage.tsx). Lite:
// the full-build pitch and its launch prompt switch. Full: the GitHub
// update check. Play: Play keeps it current.
export default function UpdateSection({ channel }: { channel: string }) {
  const requestUpdatePrompt = useAppStore((s) => s.requestUpdatePrompt);
  const updatePromptMuted = useAppStore((s) => s.updatePromptMuted);
  const setUpdatePromptMuted = useAppStore((s) => s.setUpdatePromptMuted);
  const version = installedVersion();

  if (channel === 'lite') {
    return (
      <>
        <AppCard
          title="Starter build: a brain in a jar"
          subtitle="Chat and terminal only. No eyes, no hands."
          chevron={false}
          icon={<Thumb up={false} />}
        />
        <PlainText fontSize={14} color="muted">
          Right now the agent can think but not act. It cannot see your screen, tap a button or
          type a word, so every "open WhatsApp and reply" ends in a polite shrug. The full build
          fixes that in one tap: it installs over this one, keeps your data, and gives the agent
          eyes and hands behind your fingerprint.
        </PlainText>
        <AppButton onPress={requestUpdatePrompt}>Install the full build</AppButton>
        <AppButton variant="secondary" onPress={() => void setUpdatePromptMuted(!updatePromptMuted)}>
          {updatePromptMuted ? 'Ask again on launch' : "Don't ask on launch"}
        </AppButton>
        <PlainText fontSize={13} color="muted">
          {updatePromptMuted
            ? 'The full-build offer stays quiet at launch. This button brings it back.'
            : 'The full-build offer opens every launch until you install it or silence it here.'}
        </PlainText>
      </>
    );
  }

  return (
    <>
      <AppCard
        title={channel === 'play' ? 'Updates come through Play' : 'Full build'}
        subtitle={
          channel === 'play'
            ? `v${version.version} · Play keeps it current`
            : `v${version.version} · checks GitHub on launch`
        }
        chevron={false}
        icon={<Thumb up />}
      />
      {channel !== 'play' ? (
        <AppButton variant="secondary" onPress={requestUpdatePrompt}>
          Check for updates
        </AppButton>
      ) : null}
    </>
  );
}
