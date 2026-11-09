import { create } from 'zustand';

// What JS needs to know about the soft keyboard: whether it is open (set
// when that changes), and the room the footer takes below a terminal (its
// measured height), which a terminal's keyboard spacer leaves out. The
// room the keyboard takes, frame by frame, lives on the UI thread
// (ui/common/keyboard/room.ts).
interface KeyboardState {
  open: boolean;
  /** dp: the footer tab strip's height as last laid out; null before it was. */
  footerRoom: number | null;
  setOpen: (open: boolean) => void;
  setFooterRoom: (room: number) => void;
}

export const useKeyboardStore = create<KeyboardState>((set) => ({
  open: false,
  footerRoom: null,
  setOpen: (open) => set({ open }),
  setFooterRoom: (footerRoom) => set({ footerRoom }),
}));
