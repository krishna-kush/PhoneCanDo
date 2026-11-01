import { useState } from 'react';
import { Text } from 'tamagui';
import { useAppStore } from '../../state/app';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import AppInput from '../common/AppInput';
import ConfirmDialog from '../common/ConfirmDialog';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';

// Tap a row to select it (✓ marks the active one); destructive Remove lives
// in the row's ⋮ menu with a confirm step, not as a cramped inline button.
export default function EnvScreen() {
  const envs = useAppStore((s) => s.envs);
  const activeEnvId = useAppStore((s) => s.activeEnvId);
  const setActiveEnv = useAppStore((s) => s.setActiveEnv);
  const addEnv = useAppStore((s) => s.addEnv);
  const removeEnv = useAppStore((s) => s.removeEnv);

  const [name, setName] = useState('');
  const [directory, setDirectory] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);

  return (
    <Screen>
      <SectionTitle>Environments (linux containers)</SectionTitle>
      {envs.map((env) => (
        <AppCard
          key={env.id}
          title={`${env.name}${env.id === 'default' ? ' (default)' : ''}`}
          subtitle={env.directory}
          selected={env.id === activeEnvId}
          onPress={() => setActiveEnv(env.id)}
          menuLabel={`Actions for ${env.name}`}
          menu={
            env.id !== 'default'
              ? [{ label: 'Remove', danger: true, onSelect: () => setRemoveId(env.id) }]
              : []
          }
          chevron={false}
        />
      ))}
      <SectionTitle>New environment</SectionTitle>
      <AppInput value={name} onChangeText={setName} placeholder="Name" />
      <AppInput
        value={directory}
        onChangeText={setDirectory}
        placeholder="Container path, e.g. ~/agents/work/"
      />
      <AppButton
        onPress={() => {
          void addEnv(name, directory || `~/agents/${name.trim() || 'env'}/`).then(() => {
            setName('');
            setDirectory('');
          });
        }}
      >
        Add env
      </AppButton>
      <Text fontSize={14} color="$color10">
        The active environment decides which container directory new chats attach to.
      </Text>
      <ConfirmDialog
        open={removeId != null}
        onClose={() => setRemoveId(null)}
        title="Remove environment?"
        message={`${envs.find((e) => e.id === removeId)?.name ?? ''} will be removed from the list.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeId) void removeEnv(removeId).then(() => setRemoveId(null));
        }}
      />
    </Screen>
  );
}
