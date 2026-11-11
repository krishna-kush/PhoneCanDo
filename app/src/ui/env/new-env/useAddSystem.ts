import { useAppStore } from '../../../state/app';
import { useLinuxStore } from '../../../state/linux';

// Systems' Add system. The Default system ships in the app; when it was
// deleted, Add system offers it back next to a download (AddSystem.tsx),
// else it goes straight to picking a Linux to download. Either way the
// system comes with its first agent, picked before the download.
export function useAddSystem(): () => void {
  const push = useAppStore((s) => s.push);
  const hasDefault = useLinuxStore((s) => s.envs.some((e) => e.source.kind === 'default'));
  return () => push(hasDefault ? { name: 'new-env-os' } : { name: 'add-system' });
}
