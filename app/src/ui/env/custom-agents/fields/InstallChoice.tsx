import { YStack } from 'tamagui';
import { changeInstall, INSTALL_WAYS, isPreset, type InstallWay } from '../../../../engine/agents/user/install';
import { FIELD_TAGS, fieldProblems, INSTALL_CHOICES, PACKAGE_FIELD, SCRIPT_HINT } from '../../logic/customAgentText';
import FieldLabel from '../FieldLabel';
import FormField from '../FormField';
import OptionRow from '../OptionRow';
import type { FormKit } from './types';

// How it installs: one of four, then the one field that way needs (the
// package, or the script). A change runs through changeInstall, so the
// command follows the package and a package turned into a script keeps
// its line.
export default function InstallChoice({ k }: { k: FormKit }) {
  const way = k.form.install;
  const change = (next: { install?: InstallWay; installPackage?: string }) => k.patch(changeInstall(k.form, next));
  return (
    <YStack gap="3">
      <FieldLabel label="How it installs" tag={FIELD_TAGS.install} />
      <YStack gap="2" accessibilityRole="radiogroup">
        {INSTALL_WAYS.map((w) => (
          <OptionRow
            key={w}
            role="radio"
            label={INSTALL_CHOICES[w].label}
            note={INSTALL_CHOICES[w].note}
            on={w === way}
            onToggle={() => change({ install: w })}
          />
        ))}
      </YStack>
      {isPreset(way) ? (
        <FormField
          label={PACKAGE_FIELD[way].label}
          tag={FIELD_TAGS.installPackage}
          value={k.form.installPackage}
          onChange={(v) => change({ installPackage: v })}
          placeholder={PACKAGE_FIELD[way].placeholder}
          hint={PACKAGE_FIELD[way].hint}
          problems={fieldProblems(k.problems, 'installPackage')}
        />
      ) : null}
      {way === 'script' ? (
        <FormField
          label="Install script"
          tag={FIELD_TAGS.script}
          value={k.form.script}
          onChange={(v) => k.set('script', v)}
          placeholder="pip install --user aider-chat"
          hint={SCRIPT_HINT}
          problems={fieldProblems(k.problems, 'script')}
          code
        />
      ) : null}
    </YStack>
  );
}
