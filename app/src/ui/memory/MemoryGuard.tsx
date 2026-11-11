import MemoryPill from './indicators/MemoryPill';
import ToldToast from './indicators/ToldToast';
import MemorySheet from './sheet/MemorySheet';

// The RAM warning, mounted once over Home, the pages and the drawer: the
// sheet, the pill that keeps its countdown in sight on pages, and the line
// after an automatic stop. Home's and a terminal page's bars carry their
// own chip (indicators/MemoryChip.tsx). The store is hydrated at launch.
export default function MemoryGuard() {
  return (
    <>
      <MemoryPill />
      <ToldToast />
      <MemorySheet />
    </>
  );
}
