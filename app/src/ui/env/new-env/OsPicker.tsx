import { useCallback, useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';
import { catalogOs } from '../../../engine/linux/native';
import type { CatalogImage } from '../../../engine/linux/types';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import AppInput from '../../common/AppInput';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import SectionTitle from '../../common/SectionTitle';
import { useSlidInList } from '../../nav/slidIn';
import { useAppStore } from '../../../state/app';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { linuxFailureText } from '../logic/errorText';
import { formatCount } from '../logic/format';
import { imageRefProblem, parseImageRef } from '../logic/imageRef';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';

// Official systems drawn as the page opens; the rest come once it has slid in.
const FIRST_SCREEN_CARDS = 6;

// Download a Linux, step 1: which OS, for the agent New agent picked
// (`pick`; Add system picks it after the last look). The free name field
// sits first (any image on a registry: with a tag, or
// from another registry, it skips the version list), then the official OS
// list, live from Docker Hub.
export default function OsPicker({ pick }: { pick?: AgentPick }) {
  const push = useAppStore((s) => s.push);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [list, setList] = useState<CatalogImage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    setList(null);
    catalogOs()
      .then(setList)
      .catch((e: unknown) => setLoadError(linuxFailureText(e)));
  }, []);

  useEffect(load, [load]);
  const shown = useSlidInList(list ?? [], FIRST_SCREEN_CARDS);

  const submit = () => {
    const ref = parseImageRef(name);
    if (!ref.ok) {
      setProblem(imageRefProblem(ref.reason));
      return;
    }
    setProblem(null);
    // Only Docker Hub lists versions; elsewhere the typed tag, else latest.
    if (ref.tag || !ref.hub) {
      push({
        name: 'new-env-confirm',
        repo: ref.repo,
        tag: { name: ref.tag ?? 'latest', sizeArm64: null, lastUpdated: null },
        typed: true,
        pick,
      });
    } else {
      push({ name: 'new-env-tags', repo: ref.repo, pick });
    }
  };

  return (
    <Screen>
      <PageHeader kicker={pick ? 'new agent · download' : 'add system'} title="Which Linux?" />
      <SectionTitle>Any image</SectionTitle>
      <AppInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setProblem(null);
        }}
        placeholder="any image name, e.g. kalilinux/kali-rolling"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {problem ? <Note tone="error">{problem}</Note> : null}
      <AppButton variant="secondary" onPress={submit}>
        Next
      </AppButton>

      <SectionTitle>Official systems</SectionTitle>
      {loadError ? (
        <>
          <Note tone="error">{loadError}</Note>
          <AppButton variant="secondary" onPress={load}>
            Try again
          </AppButton>
        </>
      ) : list == null ? (
        <ProgressBar label="Loading the list" fraction={null} />
      ) : (
        shown.map((os) => (
          <AppCard
            key={os.name}
            title={os.name}
            subtitle={[os.description, os.pullCount ? `${formatCount(os.pullCount)} pulls` : '']
              .filter(Boolean)
              .join(' · ')}
            icon={
              os.logoUrl ? (
                <RNImage
                  source={{ uri: os.logoUrl }}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : undefined
            }
            onPress={() => push({ name: 'new-env-tags', repo: os.name, pick })}
          />
        ))
      )}
    </Screen>
  );
}
