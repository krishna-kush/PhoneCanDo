import type { MissingTools } from '../../../engine/linux/types';
import { notPackagedLine } from '../logic/hints';
import Note from '../parts/Note';

// Under a machine's tools: the missing ones its OS doesn't package, and
// when we don't know its package manager, that they go in by hand.
// Nothing while the check's answer is unknown.
export default function ToolNotes({ tools }: { tools: MissingTools | null }) {
  if (!tools) return null;
  const { missingTools, installCommand, notPackaged } = tools;
  const unknownManager = !installCommand && notPackaged.length < missingTools.length;
  return (
    <>
      {notPackaged.length > 0 ? <Note>{notPackagedLine(notPackaged)}</Note> : null}
      {unknownManager ? <Note>We don't know its package manager, so install them by hand in a terminal.</Note> : null}
    </>
  );
}
