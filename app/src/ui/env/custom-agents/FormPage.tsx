import { useMemo, useState } from 'react';
import { useKindsStore } from '../../../state/kinds';
import AppButton from '../../common/AppButton';
import PageHeader from '../../common/PageHeader';
import { FORM_INTRO, otherProblems } from '../logic/customAgentText';
import Note from '../parts/Note';
import InstallChoice from './fields/InstallChoice';
import MoreSettings from './fields/MoreSettings';
import NameField from './fields/NameField';
import PhoneToolsField from './fields/PhoneToolsField';
import StartFields from './fields/StartFields';
import HireBadge from './form/HireBadge';
import StepStrip from './form/StepStrip';
import FormScreen from './FormScreen';
import { HelpContext, type HelpView } from './help/HelpContext';
import HelpSheet, { type OpenHelp } from './help/HelpSheet';
import { badgeId, badgeLines, badgeMood, badgeNeeds, FORM_STEPS } from './logic/badge';
import type { KindForm } from './useKindForm';

type Props = {
  k: KindForm;
  /** The kind being edited; null for a new one. */
  kindId: string | null;
  title: string;
  /** More settings, open or closed (the shell opens it for a problem in it). */
  more: { open: boolean; onOpen: (open: boolean) => void };
  /** Builds and checks the kind; the review step shows when it passes. */
  onReview: () => void;
};

// The custom agent form, one short page: where you are (step 1 of 2), the
// new agent's crew badge taking shape as you fill it in (what is needed
// ticked off on it), then name, how it installs, how it starts (and its
// ACP command), phone tools, More settings folded, the problems about no
// field, and Review. A field's ⓘ opens what it means left empty in a sheet
// (help/).
export default function FormPage({ k, kindId, title, more, onReview }: Props) {
  const [shown, setShown] = useState<OpenHelp | null>(null);
  const help = useMemo<HelpView>(() => ({ open: (label, h) => setShown({ label, help: h }) }), []);
  const taken = useKindsStore((s) => s.userKinds);
  const needs = badgeNeeds(k.form);
  const lookId = badgeId(kindId, k.form.name, taken.map((u) => u.id));
  return (
    <HelpContext.Provider value={help}>
      <FormScreen>
        <PageHeader kicker="custom agents" title={title} />
        <StepStrip steps={FORM_STEPS} at={0} />
        <HireBadge
          mode={kindId ? 'edit' : 'new'}
          name={k.form.name}
          lookId={lookId}
          lines={badgeLines(k.form)}
          mood={badgeMood(needs, k.problems.length)}
          needs={needs}
        />
        <Note>{FORM_INTRO}</Note>
        <NameField k={k} />
        <InstallChoice k={k} />
        <StartFields k={k} />
        <PhoneToolsField k={k} />
        <MoreSettings k={k} open={more.open} onOpen={more.onOpen} />
        {otherProblems(k.problems).map((p) => (
          <Note key={p} tone="error">
            {p}
          </Note>
        ))}
        {k.problems.length > 0 ? <Note tone="error">Fix what is marked, then try again.</Note> : null}
        <AppButton onPress={onReview}>Review</AppButton>
      </FormScreen>
      <HelpSheet shown={shown} onClose={() => setShown(null)} />
    </HelpContext.Provider>
  );
}
