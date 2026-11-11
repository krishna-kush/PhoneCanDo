import { useEffect } from 'react';
import { useMemoryStore } from '../../state/memory';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import AgentFace from '../common/face/AgentFace';
import PlainText from '../common/PlainText';
import SectionTitle from '../common/SectionTitle';
import { usePageActive } from '../nav/pageActive';
import { GUARD_NOTE, guardTitle, ramLine } from './logic/memoryCopy';
import { ramUse } from './logic/memoryRows';

// Settings → Agents & models → RAM guard: what the guard reads now, what
// it does whatever the caps, and the RAM warning on demand (it lists what
// runs and what each one takes at any level).
export default function RamGuardSection() {
  const status = useMemoryStore((s) => s.status);
  const openSheet = useMemoryStore((s) => s.openSheet);
  const refreshMemory = useMemoryStore((s) => s.refreshMemory);
  const active = usePageActive();

  // Native sends readings only while memory is short: read it here.
  useEffect(() => {
    if (active) refreshMemory();
  }, [active, refreshMemory]);

  const use = ramUse(status);
  return (
    <>
      <SectionTitle>RAM guard</SectionTitle>
      <AppCard
        title={guardTitle(status.level)}
        subtitle={use ? ramLine(use) : "This build doesn't measure memory yet"}
        chevron={false}
        plate={false}
        icon={<AgentFace mood={status.level === 'ok' ? 'awake' : 'sweaty'} size={26} still={!active} />}
      />
      <PlainText fontSize={14} color="muted">
        {GUARD_NOTE}
      </PlainText>
      <AppButton variant="secondary" onPress={openSheet}>
        {"See what's running"}
      </AppButton>
    </>
  );
}
