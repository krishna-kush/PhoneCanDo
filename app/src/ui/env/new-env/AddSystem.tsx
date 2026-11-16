import { useAppStore } from '../../../state/app';
import PageHeader from '../../common/PageHeader';
import RowGroup from '../../common/rows/RowGroup';
import Screen from '../../common/Screen';
import Stamp from '../../common/Stamp';
import { useSystemLogo } from '../list/useSystemLogo';
import { DEFAULT_OS_ID } from '../logic/osLogo';
import { DEFAULT_ENV_TITLE } from '../logic/titles';
import { useNewAgent } from '../new-agent/useNewAgent';
import Note from '../parts/Note';
import OsLogo from '../parts/OsLogo';
import ProgressBar from '../parts/ProgressBar';
import OsRow, { OS_ROW_LOGO } from './OsRow';

// Add system while the Default system is gone (it was deleted), as two
// rows of one key box: bring it back (instant, in the app; made with its
// first agent, after Choose agent when there is a choice), or download a
// Linux.
export default function AddSystem() {
  const push = useAppStore((s) => s.push);
  const newAgent = useNewAgent();
  const debian = useSystemLogo([DEFAULT_OS_ID]);

  return (
    <Screen>
      <PageHeader kicker="add system" title="Which system?" />
      <Note>A system is a base OS that machines are made from. It comes with its first agent, on a machine of its own.</Note>
      <RowGroup title="Pick one" barcode="addSystem">
        <OsRow
          lead={<OsLogo uri={debian} size={OS_ROW_LOGO} />}
          title={DEFAULT_ENV_TITLE}
          line="Debian-based · ready in about half a minute, no download"
          stamp={<Stamp>recommended</Stamp>}
          dim={newAgent.busy}
          onPress={() => newAgent.start({ kind: 'default' })}
        />
        <OsRow
          lead={<OsLogo uri={null} size={OS_ROW_LOGO} fallback="↓" />}
          title="Download a Linux"
          line="Any Docker image: Alpine, Ubuntu, Fedora, Arch, Kali…"
          onPress={() => push({ name: 'new-env-os' })}
        />
      </RowGroup>
      {newAgent.busy ? <ProgressBar label="Making a new agent" fraction={null} /> : null}
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <Note>Not a security sandbox: what runs in a machine can reach the network and this app's files.</Note>
    </Screen>
  );
}
