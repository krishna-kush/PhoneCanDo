import { useAppStore } from '../../../state/app';
import AppButton from '../../common/AppButton';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Note from '../parts/Note';
import FormField from './FormField';
import FormScreen from './FormScreen';
import KindReviewView from './KindReviewView';
import SafetyNotes from './SafetyNotes';
import { useImport } from './useImport';
import { useStepBack } from './useStepBack';

// Import a custom agent: paste its JSON (someone's export), then read what
// it runs, install script first, before adding it.
export default function ImportAgent() {
  const back = useAppStore((s) => s.back);
  const im = useImport();
  useStepBack(im.ready != null, im.edit);

  if (im.ready) {
    const add = () => {
      if (im.save()) back();
    };
    return (
      <Screen>
        <PageHeader kicker="custom agents · review" title={`Import ${im.ready.review.label}`} />
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
      <PageHeader kicker="custom agents" title="Import an agent" />
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
