// Whose turn it is on the floor plan. While you're here you play the user:
// now and then you give an idle agent something (it starts a turn and reads
// the notes left for it) and a busy one finishes. While you're away nobody
// starts a turn: busy agents finish, and an idle one with no job left
// running and no Keep running is stopped soon after, as the runner's idle
// stop does. The notification then lists who is kept up and why, each with
// Stop.

import { later, type Floor } from './floor';
import { setState, setWaiting, slam, nudge, type Seat } from './seats';

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** How long an inbox-only agent takes to check its inbox once its turn starts (ms). */
const CHECKS_AFTER = 1800;

export function makeTurns(floor: Floor, notice: HTMLElement) {
  function plan(seat: Seat) {
    window.clearTimeout(seat.timer);
    if (seat.state === 'stopped' || !floor.onScreen) return;
    if (floor.away) {
      if (seat.state === 'working') seat.timer = later(rand(4000, 7000), () => endTurn(seat));
      else if (!seat.job && !seat.kept) seat.timer = later(1600, () => idleStop(seat));
      return;
    }
    seat.timer =
      seat.state === 'working' ? later(rand(5000, 9000), () => endTurn(seat)) : later(rand(10000, 18000), () => startTurn(seat));
  }

  /** It reads what waits for it: at once, or for an inbox-only one when it checks. */
  function readPile(seat: Seat) {
    if (seat.waiting === 0 || seat.state !== 'working') return;
    later(seat.level === 'inbox' ? CHECKS_AFTER : 500, () => {
      if (seat.waiting === 0 || seat.state !== 'working') return;
      nudge(seat, 'gulp');
      setWaiting(seat, 0);
    });
  }

  function startTurn(seat: Seat) {
    setState(seat, 'working');
    readPile(seat);
    plan(seat);
    renderNotice();
  }

  function endTurn(seat: Seat) {
    if (seat.state !== 'working') return;
    setState(seat, 'idle');
    plan(seat);
    renderNotice();
  }

  function stop(seat: Seat, sub: string) {
    window.clearTimeout(seat.timer);
    setState(seat, 'stopped');
    slam(seat, ['Stopped', sub], 'red');
    renderNotice();
  }

  function idleStop(seat: Seat) {
    if (seat.state !== 'idle' || !floor.away || seat.job || seat.kept) return;
    stop(seat, 'idle · memory freed');
    floor.say(`${seat.name} was idle with nothing left running, so it stopped to free memory.`);
  }

  // Stop in the notification ends the agent and the job it left running.
  function userStop(seat: Seat) {
    const job = seat.job;
    seat.job = null;
    if (seat.jobChip) seat.jobChip.hidden = true;
    stop(seat, 'by you');
    floor.say(`You stopped ${seat.name}${job ? ` and ${job}` : ''}.`);
  }

  // The notification's lines: an agent busy with a chat, kept up by its job,
  // or kept running.
  function renderNotice() {
    if (!floor.away) return;
    const up = floor.seats.filter((s) => s.state !== 'stopped' && (s.state === 'working' || s.job || s.kept));
    notice.replaceChildren(
      ...up.map((s) => {
        const li = document.createElement('li');
        const why = s.state === 'working' ? 'working on a chat' : s.job ? `running ${s.job}` : 'kept running';
        li.append(Object.assign(document.createElement('span'), { textContent: `${s.name} · ${why}` }));
        const stopBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Stop' });
        stopBtn.setAttribute('aria-label', `Stop ${s.name}`);
        stopBtn.addEventListener('click', () => userStop(s));
        li.append(stopBtn);
        return li;
      }),
    );
    notice.toggleAttribute('data-empty', up.length === 0);
  }

  return { plan, readPile, startTurn, endTurn, renderNotice };
}

export type Turns = ReturnType<typeof makeTurns>;
