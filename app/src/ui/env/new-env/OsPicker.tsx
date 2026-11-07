import { useCallback, useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';
import { catalogOs } from '../../../engine/linux/native';
import type { CatalogImage } from '../../../engine/linux/types';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import AppInput from '../../common/AppInput';
import Screen from '../../common/Screen';
import SectionTitle from '../../common/SectionTitle';
import { linuxFailureText } from '../logic/errorText';
import { formatCount } from '../logic/format';
import { imageRefProblem, parseImageRef } from '../logic/imageRef';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';
import ProgressBar from '../parts/ProgressBar';

// Own env, step 2: which OS. The free name field sits first (any image on a
// registry: with a tag, or from another registry, it skips the version
// list), then the official OS list, live from Docker Hub.
export default function OsPicker() {
  const open = useEnvNav((s) => s.open);
  const back = useEnvNav((s) => s.back);
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

  const submit = () => {
    const ref = parseImageRef(name);
    if (!ref.ok) {
      setProblem(imageRefProblem(ref.reason));
      return;
    }
    setProblem(null);
    // Only Docker Hub lists versions; elsewhere the typed tag, else latest.
    if (ref.tag || !ref.hub) {
      open({
        name: 'new-env-confirm',
        repo: ref.repo,
        tag: { name: ref.tag ?? 'latest', sizeArm64: null, lastUpdated: null },
        typed: true,
      });
    } else {
      open({ name: 'new-env-tags', repo: ref.repo });
    }
  };

  return (
    <Screen>
      <PageHeader title="Own env" onBack={back} />
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
        list.map((os) => (
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
            onPress={() => open({ name: 'new-env-tags', repo: os.name })}
          />
        ))
      )}
    </Screen>
  );
}
