import { FORM_RUNTIMES } from '../../../../../engine/agents/user/form';
import { presetRuntime } from '../../../../../engine/agents/user/install';
import RowFrame from '../../../../common/rows/RowFrame';
import RowGroup from '../../../../common/rows/RowGroup';
import { fieldHelp, fieldProblems, RUNTIME_ROWS } from '../../../logic/customAgentText';
import Note from '../../../parts/Note';
import OptionRow from '../../OptionRow';
import type { FormKit } from '../types';

// The runtimes that go in before the install, rows of one key box: a
// switch each, or a line when the package install brings it itself.
export default function RuntimeFields({ k }: { k: FormKit }) {
  const brought = presetRuntime(k.form.install);
  return (
    <RowGroup title="Runtimes" barcode="runtimes">
      {FORM_RUNTIMES.map(({ id, flag }) => {
        const row = RUNTIME_ROWS[flag];
        if (brought === id) {
          return (
            <RowFrame key={id}>
              <Note>{row.withPackage}</Note>
            </RowFrame>
          );
        }
        return (
          <OptionRow
            key={id}
            label={row.label}
            note={row.note}
            on={k.form[flag]}
            onToggle={() => k.set(flag, !k.form[flag])}
            problems={fieldProblems(k.problems, flag)}
            help={fieldHelp(flag, '')}
          />
        );
      })}
    </RowGroup>
  );
}
