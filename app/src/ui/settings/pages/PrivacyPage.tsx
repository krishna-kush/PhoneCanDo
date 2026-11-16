import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { pageKicker } from '../logic/hub';
import PrivacySection from '../PrivacySection';

// Settings → Privacy: A-01's customs desk over the usage-stats switch,
// what goes out and what never does, and the user's tools (PrivacySection).
export default function PrivacyPage() {
  return (
    <Screen>
      <PageHeader kicker={pageKicker('privacy')} title="Privacy" />
      <PrivacySection />
    </Screen>
  );
}
