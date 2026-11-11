import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Note from '../parts/Note';

// An agent's page (or one of its settings) after the agent went.
export default function AgentGone() {
  return (
    <Screen>
      <PageHeader title="Agent" />
      <Note>This agent is gone.</Note>
    </Screen>
  );
}
