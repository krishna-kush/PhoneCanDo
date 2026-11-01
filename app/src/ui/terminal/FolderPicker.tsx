import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Text, YStack } from 'tamagui';
import { Directory } from 'expo-file-system';
import { useAppStore } from '../../state/app';
import { getPrefix, isRunnerAvailable } from '../../engine/runner';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import { useTheme } from '../common/globals';

// TUI entry point: pick which folder the terminal attaches to. Tree from the
// accessible root (the app container — the only place serve sessions and the
// PTY can both reach), folders only, newest picker state never persists.
// No creation here: only existing folders (creation UI was removed).
export default function FolderPicker() {
  const t = useTheme();
  const openTerminalDir = useAppStore((s) => s.openTerminalDir);
  const setFolderPickerOpen = useAppStore((s) => s.setFolderPickerOpen);
  const [root, setRoot] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string | null>(null);
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!isRunnerAvailable()) throw new Error('native module unavailable');
      const home = `${getPrefix()}/phonecando-home`;
      setRoot(home);
      setCwd(home);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (cwd == null) return;
    let cancelled = false;
    (async () => {
      try {
        const dir = new Directory(`file://${cwd}`);
        const items = dir.list();
        const subdirs: string[] = [];
        for (const item of items) {
          if (item instanceof Directory) subdirs.push(item.name);
        }
        subdirs.sort((a, b) => a.localeCompare(b));
        if (!cancelled) {
          setEntries(subdirs);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
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
