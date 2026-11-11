import { useBackInterceptor } from '../../nav/interceptors';

// Android Back on a page's second step (a review) goes to its first step
// instead of leaving the page (ui/nav/interceptors.ts). Registered only
// while that step shows.
export function useStepBack(active: boolean, back: () => void) {
  useBackInterceptor(active, back);
}
