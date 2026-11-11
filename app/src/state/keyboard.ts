import { create } from 'zustand';

// What JS needs to know about the soft keyboard: whether it is open (set
// when that changes). The room the keyboard takes, frame by frame, lives on
// the UI thread (ui/common/keyboard/room.ts).
interface KeyboardState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useKeyboardStore = create<KeyboardState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
