import { formLevel } from '../../../../../engine/agents/user/form';
import { agentLevelLine } from '../../../../messages/logic/levels';
import { FIELD_TAGS, fieldHelp, fieldProblems, MESSAGE_EVENT_HINT, MESSAGE_JSON_HINT, messageHookCommand } from '../../../logic/customAgentText';
import Note from '../../../parts/Note';
import FormField from '../../FormField';
import OptionRow from '../../OptionRow';
import type { FormKit } from '../types';

// Messages from other agents: how far they reach it, and the agent's own
// hook that hands them over (its JSON output, exit 2) when it has one.
export default function MessageFields({ k }: { k: FormKit }) {
  const event = k.form.messageEvent.trim();
  return (
    <>
      <Note>{agentLevelLine(formLevel(k.form), k.form.name.trim() || 'This agent')}</Note>
      <FormField
        label="Hook that gets them"
        tag={FIELD_TAGS.messageEvent}
        value={k.form.messageEvent}
        onChange={(v) => k.set('messageEvent', v)}
        placeholder="PostToolUse"
        hint={MESSAGE_EVENT_HINT}
        problems={fieldProblems(k.problems, 'messageEvent')}
        help={fieldHelp('messageEvent', '')}
      />
      {event !== '' ? (
        <>
          <Note>{messageHookCommand(event)}</Note>
          <FormField
            label="Its output as JSON"
            tag={FIELD_TAGS.messageJson}
            value={k.form.messageJson}
            onChange={(v) => k.set('messageJson', v)}
            placeholder='{"additionalContext":"{{messages}}"}'
            hint={MESSAGE_JSON_HINT}
            problems={fieldProblems(k.problems, 'messageJson')}
            help={fieldHelp('messageJson', '')}
            code
          />
          <OptionRow
            label="It hands them over by exiting 2"
            note="For a tool that reads a hook's stderr when it exits 2; off: stdout and exit 0."
            on={k.form.messageExit2}
            onToggle={() => k.set('messageExit2', !k.form.messageExit2)}
          />
        </>
      ) : null}
    </>
  );
}
