import RowGroup from '../../../common/rows/RowGroup';
import { fieldHelp, fieldProblems, PHONE_TOOLS_OFF, PHONE_TOOLS_ON } from '../../logic/customAgentText';
import OptionRow from '../OptionRow';
import type { FormKit } from './types';

// Whether its engine gets our bridge, and so the phone tools: a yes/no in
// a key box of its own.
export default function PhoneToolsField({ k }: { k: FormKit }) {
  return (
    <RowGroup title="On the phone" barcode="phoneToolsField">
      <OptionRow
        label="Phone tools"
        note={k.form.phoneTools ? PHONE_TOOLS_ON : PHONE_TOOLS_OFF}
        on={k.form.phoneTools}
        onToggle={() => k.set('phoneTools', !k.form.phoneTools)}
        problems={fieldProblems(k.problems, 'phoneTools')}
        help={fieldHelp('phoneTools', '')}
      />
    </RowGroup>
  );
}
