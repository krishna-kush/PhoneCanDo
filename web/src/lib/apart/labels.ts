// FIG. 01A's labels point at their layers: hovering or focusing one lifts
// its layer out of the stack (data-lit on both), and pressing one hops the
// layer and has A-01 say what it is for. While the phone is whole the
// labels are hidden, so they are inert too.

export function wireLabels(phone: HTMLElement, list: HTMLElement, still: MediaQueryList, say: (id: string) => void) {
  for (const button of list.querySelectorAll<HTMLButtonElement>('[data-label]')) {
    const id = button.dataset.label!;
    const layer = phone.querySelector<HTMLElement>(`[data-part="${id}"]`);
    const item = button.closest('li');
    const lit = (on: boolean) => {
      layer?.toggleAttribute('data-lit', on);
      item?.toggleAttribute('data-lit', on);
    };
    // A pointer press does not take focus, as on the phone (toggle.ts).
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('pointerenter', () => lit(true));
    button.addEventListener('pointerleave', () => lit(false));
    button.addEventListener('focus', () => lit(true));
    button.addEventListener('blur', () => lit(false));
    button.addEventListener('click', () => {
      say(id);
      if (still.matches) return;
      // A hop along the stack: `translate` sits outside the layer's own
      // transform, so it rides on top of the lift.
      const hop = [{ translate: '0 0 0' }, { translate: '0 0 30px', offset: 0.35 }, { translate: '0 0 0' }];
      for (const el of [layer, item]) el?.animate(hop, { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    });
  }
  return {
    set(apart: boolean) {
      list.inert = !apart;
    },
  };
}
