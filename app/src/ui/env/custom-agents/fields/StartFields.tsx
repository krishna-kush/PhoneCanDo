import { XStack } from 'tamagui';
import { commandGuess, isPreset } from '../../../../engine/agents/user/install';
import { Chip } from '../../../schedule/editor/Chip';
import { ACP_LINE, commandHint, FIELD_TAGS, fieldHelp, fieldProblems } from '../../logic/customAgentText';
import AcpNote from './AcpNote';
import FormField from '../FormField';
import type { FormKit } from './types';

// How to start it: the command (filled in from a package, editable), then
// its ACP command, optional, with a chip that fills in `<command> --acp`,
// and what to do about an agent without one.
export default function StartFields({ k }: { k: FormKit }) {
  const { form } = k;
  const command = form.command.trim();
  const acpGuess = command === '' ? '' : `${command} --acp`;
  const program = command.split(/\s+/)[0].split('/').pop() ?? '';
  const placeholder = isPreset(form.install)
    ? commandGuess(form.installPackage) || '/root/.local/bin/cli'
    : '/root/.local/bin/duck --quiet';
  return (
    <>
      <FormField
        label="Command"
        tag={FIELD_TAGS.command}
        value={form.command}
        onChange={(v) => k.set('command', v)}
        placeholder={placeholder}
        hint={commandHint(form.install)}
        problems={fieldProblems(k.problems, 'command')}
      />
      <FormField
        label="ACP command"
        tag={FIELD_TAGS.acpCommand}
        value={form.acpCommand}
        onChange={(v) => k.set('acpCommand', v)}
        placeholder={acpGuess || 'program --acp'}
        hint={ACP_LINE}
        problems={fieldProblems(k.problems, 'acpCommand')}
        help={fieldHelp('acpCommand', '')}
      />
      {form.acpCommand.trim() === '' && acpGuess !== '' ? (
        <XStack>
          <Chip
            role="button"
            on={false}
            label={`Use ${program} --acp`}
            accessibilityLabel={`Use ${acpGuess}`}
            onPress={() => k.set('acpCommand', acpGuess)}
          />
        </XStack>
      ) : null}
      <AcpNote />
    </>
  );
}
