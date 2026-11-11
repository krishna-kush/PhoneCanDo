import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { pageKicker } from '../logic/hub';
import TerminalSection from '../TerminalSection';
import ThemeSection from '../ThemeSection';

// Settings → Look & feel: the theme and the terminal's extra keys.
export default function LookPage() {
  return (
    <Screen>
      <PageHeader kicker={pageKicker('look')} title="Look & feel" />
      <ThemeSection />
      <TerminalSection />
    </Screen>
  );
}
