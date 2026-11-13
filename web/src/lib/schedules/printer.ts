// The roll's receipt (NightRoll.astro): filled at 09:00 with what each run
// did (receipt.ts says it), the longest nights cut to the first lines.

import { receiptLines, totals } from './receipt';
import type { Run } from './night';

const SHOWN = 12;

export function fillReceipt(receipt: HTMLElement, runs: Run[], names: string[], when: string) {
  const list = receipt.querySelector<HTMLElement>('[data-lines]');
  const total = receipt.querySelector<HTMLElement>('[data-total]');
  const head = receipt.querySelector<HTMLElement>('[data-receipt-when]');
  if (!list || !total || !head) return;
  head.textContent = when;
  const lines = receiptLines(runs, names);
  list.replaceChildren(
    ...lines.slice(0, SHOWN).map((l) => {
      const li = document.createElement('li');
      if (l.own) li.dataset.own = '';
      const time = document.createElement('span');
      time.textContent = l.time;
      const body = document.createElement('span');
      const who = document.createElement('b');
      who.textContent = `${l.who}: ${l.task}`;
      const what = document.createElement('i');
      what.textContent = l.what;
      body.append(who, what);
      li.append(time, body);
      return li;
    }),
  );
  if (lines.length > SHOWN) {
    const more = document.createElement('li');
    more.className = 'more';
    more.textContent = `and ${lines.length - SHOWN} more`;
    list.append(more);
  }
  total.textContent = totals(runs);
}
