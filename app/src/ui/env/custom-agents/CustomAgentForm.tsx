import { useState } from 'react';
import { useAppStore } from '../../../state/app';
import ActionDeck from '../../common/actions/ActionDeck';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Note from '../parts/Note';
import HireBadge from './form/HireBadge';
import StepStrip from './form/StepStrip';
import FormPage from './FormPage';
import KindReviewView from './KindReviewView';
import { FORM_STEPS, reviewBadgeLines, reviewStamp } from './logic/badge';
import { moreHasProblem } from './logic/moreSettings';
import SafetyNotes from './SafetyNotes';
import { useKindForm } from './useKindForm';
import { useStepBack } from './useStepBack';

type Props = { kindId: string | null; forNewAgent: boolean };

// A custom agent kind of the user's own: its fields (FormPage), then a
// review of what it runs (the install among it) before it is saved, under
// its crew badge with a stamp slammed on. Saved
// from New agent's Choose agent step, it goes back there with the new kind
// picked; else back to where it was opened. Whether More settings is open
// lives here, so it stays as it was when the review goes back to the form.
export default function CustomAgentForm({ kindId, forNewAgent }: Props) {
  const back = useAppStore((s) => s.back);
  const returnWithKind = useAppStore((s) => s.returnWithKind);
  const k = useKindForm(kindId);
  const [moreOpen, setMoreOpen] = useState(false);
  useStepBack(k.ready != null, k.edit);

  if (k.missing) {
    return (
      <Screen>
        <PageHeader kicker="custom agents" title="Custom agent" />
        <Note>This agent kind is gone, or it can't be read.</Note>
      </Screen>
    );
  }

  if (k.ready) {
    const save = () => {
      const id = k.save();
      if (!id) return;
      if (forNewAgent) returnWithKind(id);
      else back();
    };
    const mode = kindId ? 'edit' : 'new';
    const r = k.ready.review;
    return (
      <Screen>
        <PageHeader kicker="custom agents · review" title="Before you save" />
        <StepStrip steps={FORM_STEPS} at={1} />
        <HireBadge mode={mode} name={r.label} lookId={r.id} lines={reviewBadgeLines(r)} mood="happy" stamp={reviewStamp(mode)} />
        <Note>This is everything the agent runs on your phone.</Note>
        <KindReviewView review={k.ready.review} />
        <SafetyNotes />
        {k.saveError ? <Note tone="error">{k.saveError}</Note> : null}
        <ActionDeck
          barcode="deckCustomAgent"
          actions={[
            { label: kindId ? 'Save changes' : 'Save agent', role: 'go', onPress: save },
            { label: 'Back to the form', role: 'back', onPress: k.edit },
          ]}
        />
      </Screen>
    );
  }

  // A problem on a field in More settings opens it.
  const review = () => {
    if (moreHasProblem(k.review())) setMoreOpen(true);
  };

  return (
    <FormPage
      k={k}
      kindId={kindId}
      title={kindId ? `Edit ${k.form.name || 'agent'}` : 'Add your own agent'}
      more={{ open: moreOpen, onOpen: setMoreOpen }}
      onReview={review}
    />
  );
}
