import { useState } from 'react';
import { forgetToken, saveToken } from '../../../state/flows/modelActions';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import AppInput from '../../common/AppInput';
import SectionTitle from '../../common/SectionTitle';
import Note from '../../env/parts/Note';
import { useAction } from '../useAction';

// The user's Hugging Face token, for gated and private models only. It is
// kept encrypted on the phone and sent to huggingface.co alone; once saved
// the app never shows it again, so the field is cleared.
export default function HfToken() {
  const hasToken = useModelsStore((s) => s.hasToken);
  const [token, setToken] = useState('');
  const action = useAction();

  const save = async () => {
    if (await action.run(() => saveToken(token))) setToken('');
  };

  return (
    <>
      <SectionTitle>Hugging Face token</SectionTitle>
      <Note>
        Only for gated or private models. Make a read token at huggingface.co (Settings, Access Tokens). It stays on
        this phone, encrypted, and goes to huggingface.co only.
      </Note>
      {hasToken ? (
        <>
          <Note>A token is saved.</Note>
          <AppButton variant="secondary" loading={action.busy} onPress={() => void action.run(forgetToken)}>
            Remove token
          </AppButton>
        </>
      ) : (
        <>
          <AppInput
            value={token}
            onChangeText={setToken}
            placeholder="hf_…"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={() => void save()}
          />
          <AppButton variant="secondary" loading={action.busy} disabled={!token.trim()} onPress={() => void save()}>
            Save token
          </AppButton>
        </>
      )}
      {action.error ? <Note tone="error">{action.error}</Note> : null}
    </>
  );
}
