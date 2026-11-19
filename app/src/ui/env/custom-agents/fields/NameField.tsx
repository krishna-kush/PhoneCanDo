import { FIELD_TAGS, fieldProblems } from '../../logic/customAgentText';
import FormField from '../FormField';
import type { FormKit } from './types';

// The name the app shows for agents of this kind.
export default function NameField({ k }: { k: FormKit }) {
  return (
    <FormField
      label="Name"
      tag={FIELD_TAGS.name}
      value={k.form.name}
      onChange={(v) => k.set('name', v)}
      placeholder="Rubber Duck"
      problems={fieldProblems(k.problems, 'name')}
    />
  );
}
