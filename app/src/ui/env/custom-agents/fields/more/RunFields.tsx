import { FIELD_TAGS, fieldHelp, fieldProblems } from '../../../logic/customAgentText';
import FormField from '../../FormField';
import OptionRow from '../../OptionRow';
import type { FormKit } from '../types';

// While it runs: the bell rule and the chat title from the window title.
export default function RunFields({ k }: { k: FormKit }) {
  return (
    <>
      <OptionRow
        label="A bell means waiting"
        note="When it rings the terminal bell, the app shows it as waiting for you."
        on={k.form.bellWaits}
        onToggle={() => k.set('bellWaits', !k.form.bellWaits)}
        help={fieldHelp('bellWaits', '')}
      />
      <FormField
        label="Chat title from the window title"
        tag={FIELD_TAGS.titlePattern}
        value={k.form.titlePattern}
        onChange={(v) => k.set('titlePattern', v)}
        placeholder="^(.+)$"
        hint="A regex; group 1 of the window title the agent sets names its chat in the notification."
        problems={fieldProblems(k.problems, 'titlePattern')}
        help={fieldHelp('titlePattern', '')}
      />
    </>
  );
}
