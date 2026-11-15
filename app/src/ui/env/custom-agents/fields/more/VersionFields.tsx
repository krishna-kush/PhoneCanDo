import { DEFAULT_VERSION_PATTERN } from '../../../../../engine/agents/user/form';
import { FIELD_TAGS, fieldHelp, fieldProblems } from '../../../logic/customAgentText';
import FormField from '../../FormField';
import type { FormKit } from '../types';

// What prints the installed version, and where the version is in it.
export default function VersionFields({ k }: { k: FormKit }) {
  const typed = k.form.command.trim().split(/\s+/)[0];
  const program = typed || 'program';
  return (
    <>
      <FormField
        label="Version command"
        tag={FIELD_TAGS.versionCommand}
        value={k.form.versionCommand}
        onChange={(v) => k.set('versionCommand', v)}
        placeholder={`${program} --version`}
        hint="Run after the install; what it prints is the agent's version."
        problems={fieldProblems(k.problems, 'versionCommand')}
        help={fieldHelp('versionCommand', typed)}
      />
      <FormField
        label="Version pattern"
        tag={FIELD_TAGS.versionPattern}
        value={k.form.versionPattern}
        onChange={(v) => k.set('versionPattern', v)}
        placeholder={DEFAULT_VERSION_PATTERN}
        hint="A regex; group 1 is the version."
        problems={fieldProblems(k.problems, 'versionPattern')}
        help={fieldHelp('versionPattern', '')}
      />
    </>
  );
}
