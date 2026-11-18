import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useStarterStore } from '../../state/starter';
import { LICENSE_VERSION } from './licenseText';
import { asksOnItsOwn, needsAgreement } from './logic/agreement';

/** This install has not agreed to the license version this build carries. */
export function useNeedsAgreement(): boolean {
  return useAppStore((s) => needsAgreement(s.licenseAgreed?.version ?? null, LICENSE_VERSION));
}

/**
 * The license sheet asks on its own: once the stores are read, after
 * onboarding (the first shift's hello asks there) and only while this
 * install has not agreed: on 1.0.0 installs and after a new license version.
 */
export function useLicenseAsk(): boolean {
  const prefs = useAppStore((s) => s.hydrated);
  const setUp = useAppStore((s) => s.setUp);
  const stored = useAppStore((s) => s.licenseAgreed?.version ?? null);
  const starter = useStarterStore((s) => s.hydrated);
  const helloWaits = useStarterStore((s) => s.shift.status === 'new');
  const hasAgent = useAgentsStore((s) => s.agents.length > 0);
  return prefs && starter && asksOnItsOwn({ stored, current: LICENSE_VERSION, setUp, helloPending: hasAgent && helloWaits });
}
