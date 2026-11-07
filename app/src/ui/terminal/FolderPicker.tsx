import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Text, YStack } from 'tamagui';
import { useActiveAgent } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { agentHome } from '../../engine/engines';
import { listSubfolders } from '../../engine/files';
import { isRunnerAvailable } from '../../engine/runner';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import { useTheme } from '../common/globals';

// TUI entry point: pick which folder the active agent's terminal UI attaches
// to. Tree from the agent's HOME (its image's home, the place its engine and
// the PTY can both reach), folders only, picker state never persists. A
// switch of the active agent re-roots it. No creation here: only existing
// folders.
export default function FolderPicker() {
  const t = useTheme();
  const agent = useActiveAgent();
  const openTerminalDir = useAppStore((s) => s.openTerminalDir);
  const setFolderPickerOpen = useAppStore((s) => s.setFolderPickerOpen);
  const [root, setRoot] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string | null>(null);
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!isRunnerAvailable()) throw new Error('native module unavailable');
      if (!agent) throw new Error('no agent yet');
      const home = agentHome(agent);
      setRoot(home);
      setCwd(home);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    // Keyed by id and image, not the record: every refresh re-creates records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, agent?.imageId]);

  useEffect(() => {
    if (cwd == null) return;
    try {
      setEntries(listSubfolders(cwd));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [cwd]);

  const rel = cwd == null || root == null ? '' : cwd === root ? '~' : `~/${cwd.slice(root.length + 1)}`;
  const canUp = root != null && cwd != null && cwd !== root;
  const up = () => {
    if (!canUp || cwd == null) return;
    setCwd(cwd.slice(0, cwd.lastIndexOf('/')));
  };

  return (
    <Screen scroll={false}>
      <SectionTitle>Terminal folder</SectionTitle>
      {error ? (
        <Text fontSize={15} color={t.primary}>
          {error}
        </Text>
      ) : (
        <Text fontFamily="$mono" fontSize={13} color={t.muted} numberOfLines={1} ellipsizeMode="middle">
          {rel}
        </Text>
      )}
      <YStack flex={1} minHeight={0}>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <YStack gap="$2" paddingBottom="$2">
            {canUp ? (
              <AppCard title="…" subtitle="Up one level" onPress={up} chevron={false} />
            ) : null}
            {entries.map((name) => (
              <AppCard
                key={name}
                title={name}
                chevron={false}
                onPress={() => setCwd(`${cwd}/${name}`)}
              />
            ))}
            {entries.length === 0 && !error ? (
              <Text fontSize={15} color="$color10">
                No subfolders.
              </Text>
            ) : null}
          </YStack>
        </ScrollView>
      </YStack>
      <AppButton onPress={() => cwd != null && openTerminalDir(cwd)} disabled={cwd == null}>
        Open terminal UI here
      </AppButton>
      <AppButton variant="secondary" onPress={() => setFolderPickerOpen(false)}>
        Cancel
      </AppButton>
    </Screen>
  );
}
