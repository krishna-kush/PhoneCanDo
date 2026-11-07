import { useEffect, useState } from 'react';
import { freeDiskBytes } from '../../../engine/files';
import { catalogTags } from '../../../engine/linux/native';
import { createOwnEnv } from '../../../state/flows/createOwnEnv';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import Screen from '../../common/Screen';
import { linuxFailureText } from '../logic/errorText';
import { formatAgo, formatBytes } from '../logic/format';
import { isHubRepo } from '../logic/imageRef';
import type { PickedTag } from '../logic/routes';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';

// We keep the download (compressed) and unpack it into each machine: about
// this many times the download in all, before anything is installed.
const ROOM_FACTOR = 3;

// Own env, last look before the download: what, how big (looked up when the
// tag was typed), how much room the phone has. Download starts the env and
// moves to its progress page; once it is done the first agent is made on it.
export default function ConfirmPull({ repo, tag, typed }: { repo: string; tag: PickedTag; typed: boolean }) {
  const open = useEnvNav((s) => s.open);
  const back = useEnvNav((s) => s.back);
  const [size, setSize] = useState<number | null>(tag.sizeArm64);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [free] = useState(freeDiskBytes);

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

  const download = () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    let started = false;
    createOwnEnv({ image: repo, tag: tag.name }, ({ envId }) => {
      started = true;
      open({ name: 'new-env-pull', repo, tag: tag.name, envId });
    })
      .catch((e: unknown) => {
        // Once started, the download page follows the run and says what failed.
        if (!started) setError(linuxFailureText(e));
      })
      .finally(() => {
        if (!started) setStarting(false);
      });
  };

  const needed = size != null ? size * ROOM_FACTOR : null;
  const tight = needed != null && free != null && free < needed;
  const updated = formatAgo(tag.lastUpdated, Date.now());

  return (
    <Screen>
      <PageHeader title="Download" onBack={back} />
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
      {error ? <Note tone="error">{error}</Note> : null}
      <AppButton loading={starting} onPress={download}>
        Download
      </AppButton>
    </Screen>
  );
}
