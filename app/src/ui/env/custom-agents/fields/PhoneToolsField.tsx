import { fieldHelp, fieldProblems, PHONE_TOOLS_OFF, PHONE_TOOLS_ON } from '../../logic/customAgentText';
import OptionRow from '../OptionRow';
import type { FormKit } from './types';

// Whether its engine gets our bridge, and so the phone tools.
export default function PhoneToolsField({ k }: { k: FormKit }) {
  return (
    <OptionRow
      label="Phone tools"
      note={k.form.phoneTools ? PHONE_TOOLS_ON : PHONE_TOOLS_OFF}
      on={k.form.phoneTools}
      onToggle={() => k.set('phoneTools', !k.form.phoneTools)}
      problems={fieldProblems(k.problems, 'phoneTools')}
      help={fieldHelp('phoneTools', '')}
    />
  );
}
