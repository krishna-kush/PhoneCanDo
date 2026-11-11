import { useEffect, useState } from 'react';
import { freeDiskBytes } from '../../../engine/files';
import { catalogTags } from '../../../engine/linux/native';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import type { NewAgentTarget, PickedTag } from '../../../state/app';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { formatAgo, formatBytes } from '../logic/format';
import { isHubRepo } from '../logic/imageRef';
import { useNewAgent } from '../new-agent/useNewAgent';
import Note from '../parts/Note';

// We keep the download (compressed) and unpack it into each machine: about
// this many times the download in all, before anything is installed.
const ROOM_FACTOR = 3;

// Download a Linux, last look: what, how big (looked up when the tag was
// typed), how much room the phone has. Download starts the env for the
// agent New agent picked (`pick`) and moves to its progress page; once it
// is done that agent is made on it. From Add system (no pick yet), Choose
// agent comes first when there is a choice and starts it.
type Props = { repo: string; tag: PickedTag; typed: boolean; pick?: AgentPick };

export default function ConfirmPull({ repo, tag, typed, pick }: Props) {
  const [size, setSize] = useState<number | null>(tag.sizeArm64);
  const newAgent = useNewAgent();
  const [free] = useState(freeDiskBytes);
  const target: NewAgentTarget = { kind: 'own', repo, tag, typed };

  // A typed tag comes without its size; Docker Hub can tell us (other registries cannot).
  useEffect(() => {
    if (tag.sizeArm64 != null || !isHubRepo(repo)) return;
    let alive = true;
    catalogTags(repo, 1, tag.name)
      .then((res) => {
        const found = res.tags.find((t) => t.name === tag.name);
        if (alive && found?.sizeArm64 != null) setSize(found.sizeArm64);
      })
      .catch(() => {
        // The download itself says what is wrong, if anything.
      });
    return () => {
      alive = false;
    };
  }, [repo, tag.name, tag.sizeArm64]);

  const needed = size != null ? size * ROOM_FACTOR : null;
  const tight = needed != null && free != null && free < needed;
  const updated = formatAgo(tag.lastUpdated, Date.now());

  return (
    <Screen>
      <PageHeader kicker={pick ? 'new agent · last look' : 'add system · last look'} title="Download" />
      <AppCard
        title={`${repo}:${tag.name}`}
        subtitle={[size != null ? `${formatBytes(size)} download` : 'Download size unknown', updated]
          .filter(Boolean)
          .join(' · ')}
        chevron={false}
      />
      {free != null ? (
        <Note tone={tight ? 'error' : 'muted'}>
          {tight && needed != null
            ? `That may not fit: you have ${formatBytes(free)} free, and it needs about ${formatBytes(needed)} once unpacked.`
            : `You have ${formatBytes(free)} free. We keep the download and unpack it into each agent's machine, so plan for about three times its size.`}
        </Note>
      ) : null}
      {typed ? <Note>We check the name with the registry when the download starts.</Note> : null}
      <Note>You can leave the download page any time; the download keeps going.</Note>
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <AppButton loading={newAgent.busy} onPress={() => (pick ? newAgent.make(target, pick) : newAgent.start(target))}>
        {!pick && newAgent.asks(target) ? 'Choose agent' : 'Download'}
      </AppButton>
    </Screen>
  );
}
