import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { pageKicker } from '../logic/hub';
import PrivacySection from '../PrivacySection';

// Settings → Privacy: the usage-stats switch and the user's tools.
export default function PrivacyPage() {
  return (
    <Screen>
      <PageHeader kicker={pageKicker('privacy')} title="Privacy" />
      <PrivacySection />
    </Screen>
  );
}
