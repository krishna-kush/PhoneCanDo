import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { sheetOverlay } from '../../../../tamagui.config';
import { useBackInterceptor } from '../../nav/interceptors';
import { useScheme, useTheme } from '../globals';
import { useReduceMotion } from '../useReduceMotion';
import { ScrollSlot, type SheetList } from './scrollSlot';

// The share of the screen a sheet may take before its list scrolls.
const MAX_SHARE = 0.9;

type Props = {
  open: boolean;
  /** The sheet closed itself: a drag down, a tap on the scrim or Back. */
  onClose: () => void;
  /** Stays at the top while the content scrolls. */
  header?: ReactElement;
  /** Stays at the bottom while the content scrolls. */
  footer?: ReactElement;
  /** The panel; mounted anew each time the sheet opens. A list in it is a SheetScroll. */
  children: ReactNode;
  /**
   * Only the panel's own buttons close it: no drag, scrim tap or Back.
   * Back runs [onBlocked] instead (the license ask leaves the app with it).
   */
  locked?: boolean;
  onBlocked?: () => void;
};

// A sheet over everything, as Android's own bottom sheet
// (react-native-true-sheet, Material's BottomSheetBehavior): a drag down, a
// flick, a tap on the scrim or Back closes it the way any Android sheet
// closes (unless `locked`), and a long list (SheetScroll) scrolls before the
// sheet moves. It sits in the activity over every page and the drawer; our dialogs, windows
// of their own, still open above it. Our look on it: the panel's colour with
// the strong line on top, square corners, the theme's scrim.
//
// Each opening mounts a sheet of its own (a new key) that presents itself
// once mounted. A dismissal while the parent still asks for it open was the
// user's, so it calls onClose; one the parent asked for does not.
export default function BottomSheet({ open, onClose, header, footer, children, locked = false, onBlocked }: Props) {
  const t = useTheme();
  const scheme = useScheme();
  const reduce = useReduceMotion();
  const { height } = useWindowDimensions();
  const sheet = useRef<TrueSheet>(null);
  const list = useRef<SheetList>(null);
  const [round, setRound] = useState(open ? 1 : 0);
  const [mounted, setMounted] = useState(open);
  // What the parent last asked for, and the newest opening.
  const asked = useRef(open);
  const latest = useRef(round);

  const dismissed = (of: number) => {
    // An older sheet, cut short by a new opening.
    if (of !== latest.current) return;
    setMounted(false);
    if (!asked.current) return;
    asked.current = false;
    onClose();
  };

  useEffect(() => {
    if (open === asked.current) return;
    asked.current = open;
    if (open) {
      latest.current += 1;
      setRound(latest.current);
      setMounted(true);
      return;
    }
    // Also once dismiss() settles: closed before it finished mounting, the
    // sheet never presents, so it never tells us it went.
    const of = latest.current;
    const done = () => dismissed(of);
    if (sheet.current) sheet.current.dismiss(!reduce).then(done, done);
    else done();
  }, [open, reduce]);

  // Back from a page or the drawer comes down our chain, not the sheet's own listener.
  useBackInterceptor(mounted && open, () => (locked ? onBlocked?.() : void sheet.current?.dismiss(!reduce)));

  if (!mounted) return null;
  return (
    <TrueSheet
      key={round}
      ref={sheet}
      detents={['auto']}
      initialDetentIndex={0}
      initialDetentAnimated={!reduce}
      maxContentHeight={height * MAX_SHARE}
      cornerRadius={0}
      grabber={false}
      elevation={0}
      backgroundColor={t.panel}
      background={<View style={[StyleSheet.absoluteFill, { backgroundColor: t.panel, borderTopWidth: 1, borderColor: t.lineStrong }]} />}
      dimColor={sheetOverlay[scheme]}
      dimOpacity={1}
      header={header}
      footer={footer}
      style={styles.content}
      scrollableRef={list}
      dismissible={!locked}
      onDismissAttempt={() => onBlocked?.()}
      onDidDismiss={() => dismissed(round)}
    >
      <ScrollSlot.Provider value={list}>{children}</ScrollSlot.Provider>
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  // The content between the header and the footer gives way to them: without
  // it, a list taller than the sheet keeps its whole height, never scrolls
  // and pushes its foot and the footer out of the sheet. The auto height
  // still comes from what the content wants (TrueSheet measures it unbounded).
  content: { flex: 1 },
});
