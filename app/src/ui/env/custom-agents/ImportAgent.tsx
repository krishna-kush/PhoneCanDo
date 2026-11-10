import AppButton from '../../common/AppButton';
import Screen from '../../common/Screen';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';
import FormField from './FormField';
import FormScreen from './FormScreen';
import KindReviewView from './KindReviewView';
import SafetyNotes from './SafetyNotes';
import { useImport } from './useImport';
import { useStepBack } from './useStepBack';

// Import a custom agent: paste its JSON (someone's export), then read what
// it runs, install script first, before adding it.
export default function ImportAgent() {
  const open = useEnvNav((s) => s.open);
  const back = useEnvNav((s) => s.back);
  const im = useImport();
  useStepBack(im.ready != null, im.edit);

  if (im.ready) {
    const add = () => {
      if (im.save()) open({ name: 'custom-agents' });
    };
    return (
      <Screen>
        <PageHeader title={`Import ${im.ready.review.label}`} onBack={im.edit} />
        <Note>This is everything the agent runs on your phone. Read it before you add it.</Note>
        <KindReviewView review={im.ready.review} />
        <SafetyNotes />
        {im.ready.replaces ? (
          <Note tone="error">{`It replaces your agent ${im.ready.replaces} (${im.ready.review.id}).`}</Note>
        ) : null}
        {im.saveError ? <Note tone="error">{im.saveError}</Note> : null}
        <AppButton onPress={add}>{im.ready.replaces ? 'Replace agent' : 'Add agent'}</AppButton>
        <AppButton variant="secondary" onPress={im.edit}>
          Back
        </AppButton>
      </Screen>
    );
  }

  return (
    <FormScreen>
      <PageHeader title="Import an agent" onBack={back} />
      <Note>Paste an agent exported from PhoneCanDo: its whole JSON, from the first brace to the last.</Note>
      <AppButton variant="secondary" onPress={im.paste}>
        Paste from clipboard
      </AppButton>
      <FormField label="Agent JSON" value={im.text} onChange={im.change} placeholder='{ "schema": 1, … }' problems={im.problems} code />
      <SafetyNotes />
      <AppButton onPress={im.review} disabled={im.text.trim() === ''}>
        Review
      </AppButton>
    </FormScreen>
  );
}
