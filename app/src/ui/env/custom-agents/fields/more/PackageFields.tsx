import { useState } from 'react';
import { FORM_FAMILIES } from '../../../../../engine/agents/user/form';
import AppButton from '../../../../common/AppButton';
import { familyName, FIELD_TAGS, fieldHelp, fieldProblems } from '../../../logic/customAgentText';
import Note from '../../../parts/Note';
import FormField from '../../FormField';
import type { FormKit } from '../types';

// The machine's own packages, for any OS, and per family when they differ.
export default function PackageFields({ k }: { k: FormKit }) {
  const [perOs, setPerOs] = useState(() => Object.keys(k.form.familyPackages).length > 0);
  return (
    <>
      <FormField
        label="Packages"
        tag={FIELD_TAGS.packages}
        value={k.form.packages}
        onChange={(v) => k.set('packages', v)}
        placeholder="git ripgrep"
        hint="Installed with the machine's package manager before the install steps."
        problems={fieldProblems(k.problems, 'packages')}
        help={fieldHelp('packages', '')}
      />
      {perOs ? (
        FORM_FAMILIES.map((family) => (
          <FormField
            key={family}
            label={`Packages, ${familyName(family)}`}
            tag={FIELD_TAGS.familyPackages}
            value={k.form.familyPackages[family] ?? ''}
            onChange={(v) => k.set('familyPackages', { ...k.form.familyPackages, [family]: v })}
            help={fieldHelp('familyPackages', '')}
          />
        ))
      ) : (
        <AppButton variant="ghost" onPress={() => setPerOs(true)}>
          Packages per OS
        </AppButton>
      )}
      {fieldProblems(k.problems, 'familyPackages').map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
    </>
  );
}
