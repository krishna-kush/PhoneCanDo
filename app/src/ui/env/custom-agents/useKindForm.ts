import { useCallback, useState } from 'react';
import { buildUserManifest, type FormProblem } from '../../../engine/agents/user/build';
import { emptyForm, type UserAgentForm } from '../../../engine/agents/user/form';
import { reviewOf, type KindReview } from '../../../engine/agents/user/review';
import { checkKind, kindForEdit, saveKind } from '../../../state/flows/userKinds';
import { useKindsStore } from '../../../state/kinds';

type Ready = { text: string; review: KindReview };

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// The custom agent form's state and its two steps: edit the fields (a new
// kind's, empty, or the saved kind's for an edit), then review what the
// kind runs and save it. `review` builds the manifest (the kit's rules),
// asks the runner's own check, and moves on only when both pass; their
// problems land under the fields they are about, or above the button.
export function useKindForm(kindId: string | null) {
  const [loaded] = useState(() => (kindId ? kindForEdit(kindId) : null));
  const [form, setForm] = useState<UserAgentForm>(() => loaded?.form ?? emptyForm());
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [ready, setReady] = useState<Ready | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof UserAgentForm>(key: K, value: UserAgentForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setProblems((ps) => ps.filter((p) => p.field !== key));
  };

  const review = () => {
    useKindsStore.getState().readUserKinds();
    const taken = useKindsStore.getState().userKinds.map((k) => k.id);
    const built = buildUserManifest(form, { base: loaded?.base ?? null, taken });
    if (!built.ok) {
      setProblems(built.problems);
      return;
    }
    try {
      const native = checkKind(built.text);
      if (native.length > 0) {
        setProblems(native.map((text) => ({ field: null, text })));
        return;
      }
    } catch (e) {
      setProblems([{ field: null, text: errorText(e) }]);
      return;
    }
    setProblems([]);
    setSaveError(null);
    setReady({ text: built.text, review: reviewOf(built.manifest) });
  };

  const edit = useCallback(() => setReady(null), []);

  /** The saved kind's id; null when it was not saved (saveError says why). */
  const save = (): string | null => {
    if (!ready) return null;
    try {
      const saved = saveKind(ready.text, kindId != null);
      if (saved.ok) return saved.id;
      setSaveError(saved.problems.join('\n'));
    } catch (e) {
      setSaveError(errorText(e));
    }
    return null;
  };

  return { missing: kindId != null && loaded == null, form, set, problems, ready, review, edit, save, saveError };
}
