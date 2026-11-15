import type { KindForm } from '../useKindForm';

/** What a field of the custom agent form reads and writes: the form, its setters and its problems. */
export type FormKit = Pick<KindForm, 'form' | 'set' | 'patch' | 'problems'>;
