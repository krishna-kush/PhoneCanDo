import { useState } from 'react';
import { DEFAULT_VERSION_PATTERN, FORM_FAMILIES } from '../../../engine/agents/user/form';
import { useAppStore } from '../../../state/app';
import AppButton from '../../common/AppButton';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import SectionTitle from '../../common/SectionTitle';
import {
  familyName,
  fieldProblems,
  otherProblems,
  PHONE_TOOLS_OFF,
  PHONE_TOOLS_ON,
} from '../logic/customAgentText';
import Note from '../parts/Note';
import FormField from './FormField';
import FormScreen from './FormScreen';
import KindReviewView from './KindReviewView';
import OptionRow from './OptionRow';
import SafetyNotes from './SafetyNotes';
import { useKindForm } from './useKindForm';
import { useStepBack } from './useStepBack';

type Props = { kindId: string | null; forNewAgent: boolean };

// A custom agent kind of the user's own: its fields, then a review of what
// it runs (the install script among it) before it is saved. Saved from New
// agent's Choose agent step, it goes back there with the new kind picked;
// else back to where it was opened.
export default function CustomAgentForm({ kindId, forNewAgent }: Props) {
  const back = useAppStore((s) => s.back);
  const returnWithKind = useAppStore((s) => s.returnWithKind);
  const k = useKindForm(kindId);
  const [perOs, setPerOs] = useState(() => Object.keys(k.form.familyPackages).length > 0);
  useStepBack(k.ready != null, k.edit);

  if (k.missing) {
    return (
      <Screen>
        <PageHeader kicker="custom agents" title="Custom agent" />
        <Note>This agent kind is gone, or it can't be read.</Note>
      </Screen>
    );
  }

  const title = kindId ? `Edit ${k.form.name || 'agent'}` : 'Add your own agent';

  if (k.ready) {
    const save = () => {
      const id = k.save();
      if (!id) return;
      if (forNewAgent) returnWithKind(id);
      else back();
    };
    return (
      <Screen>
        <PageHeader kicker="custom agents · review" title="Before you save" />
        <Note>This is everything the agent runs on your phone.</Note>
        <KindReviewView review={k.ready.review} />
        <SafetyNotes />
        {k.saveError ? <Note tone="error">{k.saveError}</Note> : null}
        <AppButton onPress={save}>{kindId ? 'Save changes' : 'Save agent'}</AppButton>
        <AppButton variant="secondary" onPress={k.edit}>
          Back to the form
        </AppButton>
      </Screen>
    );
  }

  const problems = (field: Parameters<typeof fieldProblems>[1]) => fieldProblems(k.problems, field);
  const program = k.form.command.trim().split(/\s+/)[0] || 'program';

  return (
    <FormScreen>
      <PageHeader kicker="custom agents" title={title} />
      <Note>
        Any agent with a terminal UI. It gets its own machine like the others, and Home shows its terminal.
      </Note>
      <FormField label="Name" value={k.form.name} onChange={(v) => k.set('name', v)} placeholder="Aider" problems={problems('name')} />
      <FormField
        label="Command"
        value={k.form.command}
        onChange={(v) => k.set('command', v)}
        placeholder="/root/.local/bin/aider --no-auto-commits"
        hint="What starts it in its machine. Use the full path when it isn't on PATH. Quotes group words; nothing else is expanded."
        problems={problems('command')}
      />

      <SectionTitle>Install</SectionTitle>
      <FormField
        label="Install script"
        value={k.form.script}
        onChange={(v) => k.set('script', v)}
        placeholder={'pip install --user aider-chat'}
        hint="Runs as root in the agent's machine, with HOME at /root. A blank line starts the next step. A step that fails runs again, so make each safe to rerun. Update agent runs it again."
        problems={problems('script')}
        code
      />
      <FormField
        label="Packages"
        value={k.form.packages}
        onChange={(v) => k.set('packages', v)}
        placeholder="git ripgrep"
        hint="Installed with the machine's package manager before the script."
        problems={problems('packages')}
      />
      {perOs ? (
        FORM_FAMILIES.map((family) => (
          <FormField
            key={family}
            label={`Packages, ${familyName(family)}`}
            value={k.form.familyPackages[family] ?? ''}
            onChange={(v) => k.set('familyPackages', { ...k.form.familyPackages, [family]: v })}
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
      <OptionRow
        label="Needs Node.js 22"
        note="Node.js 22 or newer goes in first, on PATH for the script and the agent."
        on={k.form.needsNode}
        onToggle={() => k.set('needsNode', !k.form.needsNode)}
        problems={problems('needsNode')}
      />
      <FormField
        label="Version command"
        value={k.form.versionCommand}
        onChange={(v) => k.set('versionCommand', v)}
        placeholder={`${program} --version`}
        hint="Run after the install; what it prints is the agent's version."
        problems={problems('versionCommand')}
      />
      <FormField
        label="Version pattern"
        value={k.form.versionPattern}
        onChange={(v) => k.set('versionPattern', v)}
        placeholder={DEFAULT_VERSION_PATTERN}
        hint="A regex; group 1 is the version."
        problems={problems('versionPattern')}
      />

      <SectionTitle>While it runs</SectionTitle>
      <OptionRow
        label="A bell means waiting"
        note="When it rings the terminal bell, the app shows it as waiting for you."
        on={k.form.bellWaits}
        onToggle={() => k.set('bellWaits', !k.form.bellWaits)}
      />
      <FormField
        label="Chat title from the window title"
        value={k.form.titlePattern}
        onChange={(v) => k.set('titlePattern', v)}
        placeholder="^(.+)$"
        hint="A regex; group 1 of the window title the agent sets names its chat in the notification. Empty: none."
        problems={problems('titlePattern')}
      />
      <OptionRow
        label="Phone tools"
        note={k.form.phoneTools ? PHONE_TOOLS_ON : PHONE_TOOLS_OFF}
        on={k.form.phoneTools}
        onToggle={() => k.set('phoneTools', !k.form.phoneTools)}
        problems={problems('phoneTools')}
      />

      <SafetyNotes />
      {otherProblems(k.problems).map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
      {k.problems.length > 0 ? <Note tone="error">Fix what is marked, then try again.</Note> : null}
      <AppButton onPress={k.review}>Review</AppButton>
    </FormScreen>
  );
}
