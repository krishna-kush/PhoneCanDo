import type { SettingsPageId } from '../../state/app';
import AgentsPage from './pages/AgentsPage';
import LookPage from './pages/LookPage';
import PrivacyPage from './pages/PrivacyPage';
import UpdatesPage from './pages/UpdatesPage';

// One of Settings' pages, by the hub row that opened it.
export default function SettingsPage({ page }: { page: SettingsPageId }) {
  switch (page) {
    case 'look':
      return <LookPage />;
    case 'agents':
      return <AgentsPage />;
    case 'privacy':
      return <PrivacyPage />;
    case 'updates':
      return <UpdatesPage />;
  }
}
