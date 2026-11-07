import { create } from 'zustand';
import { parentRoute, type EnvRoute } from './logic/routes';

// Which Env tab page is showing (see logic/routes.ts for why it is a store).
interface EnvNavState {
  route: EnvRoute;
  open: (route: EnvRoute) => void;
  /** One page up; false when already on the list. */
  back: () => boolean;
}

export const useEnvNav = create<EnvNavState>((set, get) => ({
  route: { name: 'list' },
  open: (route) => set({ route }),
  back: () => {
    const up = parentRoute(get().route);
    if (!up) return false;
    set({ route: up });
    return true;
  },
}));
