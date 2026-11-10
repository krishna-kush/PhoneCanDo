import { useCallback, useState } from 'react';
import { parseImport } from '../../../engine/agents/user/imports';
import { reviewOf, type KindReview } from '../../../engine/agents/user/review';
import { clipboardText } from '../../../engine/sharing';
import { checkKind, saveKind } from '../../../state/flows/userKinds';
import { useKindsStore } from '../../../state/kinds';

type Ready = {
  text: string;
  review: KindReview;
  /** The label of the user's kind it replaces (same id); null for a new one. */
  replaces: string | null;
};

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// A custom agent pasted in, in two steps: the JSON (typed, or from the
// clipboard), then a review of everything it runs before it is added.
// Review moves on only when the kit's rules and the runner's check pass.
export function useImport() {
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [ready, setReady] = useState<Ready | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const change = (value: string) => {
    setText(value);
    setProblems([]);
  };

  const paste = () => {
    const pasted = clipboardText();
    if (pasted == null) setProblems(['The clipboard has no text.']);
    else change(pasted);
  };

  const review = () => {
    const parsed = parseImport(text);
    if (!parsed.ok) {
      setProblems(parsed.problems);
      return;
    }
    try {
      const native = checkKind(parsed.text);
      if (native.length > 0) {
        setProblems(native);
        return;
      }
    } catch (e) {
      setProblems([errorText(e)]);
      return;
    }
    useKindsStore.getState().readUserKinds();
    const same = useKindsStore.getState().userKinds.find((k) => k.id === parsed.id);
    setSaveError(null);
    setReady({ text: parsed.text, review: reviewOf(parsed.manifest), replaces: same ? (same.label ?? same.id) : null });
  };

  const edit = useCallback(() => setReady(null), []);

  /** True once it is saved (saveError says why not). */
  const save = (): boolean => {
    if (!ready) return false;
    try {
      const saved = saveKind(ready.text, ready.replaces != null);
      if (saved.ok) return true;
      setSaveError(saved.problems.join('\n'));
    } catch (e) {
      setSaveError(errorText(e));
    }
    return false;
  };

  return { text, change, paste, problems, ready, review, edit, save, saveError };
}
