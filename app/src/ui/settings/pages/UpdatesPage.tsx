import { getBuildChannel } from '../../../engine/runner';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { pageKicker } from '../logic/hub';
import UpdateSection from '../UpdateSection';

// Settings → Updates: the GitHub check (full), the full-build offer (lite)
// or Play's word on it (play).
export default function UpdatesPage() {
  return (
    <Screen>
      <PageHeader kicker={pageKicker('updates')} title="Updates" />
      <UpdateSection channel={getBuildChannel()} />
    </Screen>
  );
}
