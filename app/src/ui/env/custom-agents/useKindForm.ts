import { useCallback, useState } from 'react';
import { buildUserManifest, type FormProblem } from '../../../engine/agents/user/build';
import { emptyForm, type UserAgentForm } from '../../../engine/agents/user/form';
import { reviewOf, type KindReview } from '../../../engine/agents/user/review';
import { errorMessage } from '../../../engine/errors/message';
import { checkKind, kindForEdit, saveKind } from '../../../state/flows/userKinds';
import { useKindsStore } from '../../../state/kinds';

type Ready = { text: string; review: KindReview };


export type KindForm = ReturnType<typeof useKindForm>;

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

  /** Several fields at once; their problems go. */
  const patch = (values: Partial<UserAgentForm>) => {
    setForm((f) => ({ ...f, ...values }));
    setProblems((ps) => ps.filter((p) => p.field == null || !(p.field in values)));
  };

  const set = <K extends keyof UserAgentForm>(key: K, value: UserAgentForm[K]) => patch({ [key]: value } as Partial<UserAgentForm>);

  /** The problems that keep it from the review step; empty when it shows. */
  const review = (): FormProblem[] => {
    useKindsStore.getState().readUserKinds();
    const taken = useKindsStore.getState().userKinds.map((k) => k.id);
    const built = buildUserManifest(form, { base: loaded?.base ?? null, taken });
    const fail = (ps: FormProblem[]) => {
      setProblems(ps);
      return ps;
    };
    if (!built.ok) return fail(built.problems);
    try {
      const native = checkKind(built.text);
      if (native.length > 0) return fail(native.map((text) => ({ field: null, text })));
    } catch (e) {
      return fail([{ field: null, text: errorMessage(e) }]);
    }
    setProblems([]);
    setSaveError(null);
    setReady({ text: built.text, review: reviewOf(built.manifest) });
    return [];
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
      setSaveError(errorMessage(e));
    }
    return null;
  };

  return { missing: kindId != null && loaded == null, form, set, patch, problems, ready, review, edit, save, saveError };
}
