import { installedVersion } from '../../engine/updates';
import { useAppStore } from '../../state/app';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import RowGroup from '../common/rows/RowGroup';
import SwitchRow from '../common/rows/SwitchRow';
import BuildLabel from './updates/BuildLabel';
import { channelOf } from './updates/copy';
import Courier from './updates/Courier';
import LiteBox from './updates/LiteBox';
import RouteFacts from './updates/RouteFacts';

// Settings → Updates, the body of its page (pages/UpdatesPage.tsx): the
// build on this phone as a parcel's label (updates/). Lite: its packing
// list, the full-build pitch and whether that offer opens at launch. Full:
// A-01 on the porch and the GitHub update check. Play: Play keeps it
// current. Either of those two says how a new build reaches you.
export default function UpdateSection({ channel: name }: { channel: string }) {
  const requestUpdatePrompt = useAppStore((s) => s.requestUpdatePrompt);
  const updatePromptMuted = useAppStore((s) => s.updatePromptMuted);
  const setUpdatePromptMuted = useAppStore((s) => s.setUpdatePromptMuted);
  const version = installedVersion();
  const channel = channelOf(name);
  const label = <BuildLabel channel={channel} version={version.version} versionCode={version.versionCode} />;

  if (channel === 'lite') {
    return (
      <>
        {label}
        <LiteBox />
        <PlainText fontSize={14} color="muted">
          Right now the agent can think but not act. It cannot see your screen, tap a button or
          type a word, so every "open WhatsApp and reply" ends in a polite shrug. The full build
          fixes that in one tap: it installs over this one, keeps your data, and gives the agent
          eyes and hands behind your fingerprint.
        </PlainText>
        <AppButton onPress={requestUpdatePrompt}>Install the full build</AppButton>
        <RowGroup title="At launch" barcode="atLaunch">
          <SwitchRow
            title="Offer the full build"
            on={!updatePromptMuted}
            onToggle={() => void setUpdatePromptMuted(!updatePromptMuted)}
            note={
              updatePromptMuted
                ? 'The full-build offer stays quiet at launch. Turn this on to bring it back.'
                : 'The full-build offer opens once at launch for each new full build, never twice for the same one.'
            }
          />
        </RowGroup>
      </>
    );
  }

  return (
    <>
      {label}
      <Courier channel={channel} />
      <RouteFacts channel={channel} />
    </>
  );
}
