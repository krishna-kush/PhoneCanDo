// The interactive scripts/data.mjs: a full-screen view on the terminal's
// alternate screen with tabs, scrolling, list selection, detail screens and
// reload. Raw keys through node:readline; every frame is painted line by line
// with absolute cursor moves, and the terminal is restored on every exit path.

import { emitKeypressEvents } from 'node:readline';
import { errorDetail, helpLines, reportDetail } from './detail.mjs';
import { clip, fit, num, pad, width } from './paint.mjs';
import { WINDOWS } from './queries.mjs';
import { TABS, renderTab } from './views.mjs';

const CSI = '\x1b[';
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const MAX_WIDTH = 140;

/** The next window for the `w` key: 7 → 30 → 90 → 7 (a custom --days joins the cycle at the next larger one). */
export function nextWindow(days) {
  return WINDOWS.find((d) => d > days) ?? WINDOWS[0];
}

/**
 * Runs until the user quits. `load({ days, testers })` resolves a model
 * (scripts/data/model.mjs) or rejects with a message to show.
 */
export function runTui({ load, days, testers, style, stdin = process.stdin, stdout = process.stdout }) {
  const st = { tab: 0, scroll: 0, sel: {}, detail: false, help: false, days, testers, model: null, error: null, loading: false, took: 0, spin: 0 };
  let seq = 0;
  let spinner = null;
  let body = 10;
  let focusItems = [];

  return new Promise((resolve) => {
    const size = () => ({ w: stdout.columns || 100, h: stdout.rows || 30 });
    const tab = () => TABS[st.tab];
    const listItems = () => (st.model ? (tab().id === 'errors' ? st.model.errors.keys : tab().id === 'reports' ? st.model.reports : []) : []);
    const selected = () => Math.min(st.sel[tab().id] ?? 0, Math.max(0, listItems().length - 1));

    function header(w) {
      const title = ` ${style.accent('◆')} ${style.bold('PhoneCanDo')} ${style.dim('usage data')}`;
      const m = st.model?.meta;
      const facts = [
        m ? `D1 ${m.database}` : null,
        m ? `via ${m.source}` : null,
        `${st.days} days`,
        st.testers ? style.warn('testers shown') : 'testers hidden',
        `${new Date().toISOString().slice(11, 16)} UTC`,
      ]
        .filter(Boolean)
        .join(style.dim(' · '));
      const top = `${title}${' '.repeat(Math.max(1, w - width(title) - width(facts) - 1))}${style.dim(facts)}`;
      const tabs = TABS.map((t, i) => {
        const label = ` ${i + 1} ${t.title} `;
        return i === st.tab ? style.inverse(style.accent(label)) : style.dim(label);
      }).join('');
      return [top, ` ${tabs}`, style.dim('─'.repeat(w))];
    }

    function footer(w) {
      const keys = st.detail ? 'esc back  ↑↓ scroll  q quit' : `←→ tabs  ↑↓ ${tab().list ? 'select  enter open' : 'scroll'}  w window  t testers  r reload  ? help  q quit`;
      let status;
      if (st.loading) status = style.accent(`${SPIN[st.spin % SPIN.length]} reading D1…`);
      else if (st.error) status = style.bad(fit(st.error, Math.max(20, w - width(keys) - 4)));
      else if (st.model) status = style.dim(`${num(st.model.meta.rowsRead)} rows read · ${(st.took / 1000).toFixed(1)} s`);
      else status = '';
      return [style.dim('─'.repeat(w)), ` ${style.dim(keys)}${' '.repeat(Math.max(1, w - width(keys) - width(status) - 2))}${status}`];
    }

    function content(w) {
      if (st.help) return { lines: helpLines({ w, style }) };
      if (!st.model) {
        if (st.error) return { lines: ['', style.bad(`  Could not read the data: ${st.error}`), '', style.dim('  r to retry · q to quit')] };
        return { lines: ['', style.dim('  Reading from D1…')] };
      }
      const now = st.model.meta.now;
      if (st.detail) {
        const item = listItems()[selected()];
        if (!item) return { lines: [] };
        return { lines: tab().id === 'errors' ? errorDetail(item, { w, style, now }) : reportDetail(item, { w, style, now }) };
      }
      const out = renderTab(tab().id, st.model, { w, style, selected: tab().list ? selected() : -1 });
      return { lines: out.lines, focus: tab().list ? out.items[selected()] : undefined, items: out.items };
    }

    function draw() {
      const { w, h } = size();
      const cw = Math.min(w, MAX_WIDTH);
      const head = header(cw);
      const foot = footer(cw);
      body = Math.max(3, h - head.length - foot.length);
      const { lines, focus, items = [] } = content(cw);
      focusItems = items;
      if (focus !== undefined) {
        // Keep the selected entry and its second line in view.
        if (focus < st.scroll) st.scroll = Math.max(0, focus - 1);
        if (focus + 2 > st.scroll + body) st.scroll = focus + 2 - body;
      }
      st.scroll = Math.min(Math.max(0, st.scroll), Math.max(0, lines.length - body));
      const shown = lines.slice(st.scroll, st.scroll + body);
      const more = lines.length > body ? style.dim(` ${st.scroll + 1}–${Math.min(lines.length, st.scroll + body)} of ${lines.length} `) : '';
      if (more && shown.length) shown[shown.length - 1] = `${pad(clip(shown[shown.length - 1], cw - width(more)), cw - width(more))}${more}`;
      const frame = [...head, ...shown, ...Array(Math.max(0, body - shown.length)).fill(''), ...foot];
      let out = `${CSI}?25l`;
      frame.forEach((line, i) => {
        out += `${CSI}${i + 1};1H${clip(line, w)}${CSI}K`;
      });
      stdout.write(`${out}${CSI}J`);
    }

    async function reload() {
      const mine = ++seq;
      st.loading = true;
      st.error = null;
      spinner ??= setInterval(() => {
        st.spin++;
        draw();
      }, 100);
      draw();
      const t0 = Date.now();
      try {
        const model = await load({ days: st.days, testers: st.testers });
        if (mine !== seq) return;
        st.model = model;
        st.took = Date.now() - t0;
      } catch (e) {
        if (mine === seq) st.error = e?.message ?? String(e);
      } finally {
        if (mine === seq) {
          st.loading = false;
          clearInterval(spinner);
          spinner = null;
          draw();
        }
      }
    }

    function moveTab(to) {
      st.tab = (to + TABS.length) % TABS.length;
      st.scroll = 0;
      st.detail = false;
    }

    function move(delta) {
      if (tab().list && !st.detail && !st.help) {
        const n = listItems().length;
        if (n) st.sel[tab().id] = Math.min(n - 1, Math.max(0, selected() + delta));
      } else st.scroll += delta;
    }

    function onKey(str, key = {}) {
      const name = key.name ?? str;
      if ((key.ctrl && name === 'c') || name === 'q') return quit();
      if (st.help) {
        st.help = false;
        return draw();
      }
      if (st.detail && (name === 'escape' || name === 'backspace' || name === 'left' || name === 'h')) {
        st.detail = false;
        st.scroll = 0;
        return draw();
      }
      switch (name) {
        case 'right':
        case 'l':
          moveTab(st.tab + 1);
          break;
        case 'left':
        case 'h':
          moveTab(st.tab - 1);
          break;
        case 'tab':
          moveTab(st.tab + (key.shift ? -1 : 1));
          break;
        case 'down':
        case 'j':
          move(1);
          break;
        case 'up':
        case 'k':
          move(-1);
          break;
        case 'pagedown':
        case 'space':
          if (tab().list && !st.detail) move(5);
          else st.scroll += body - 2;
          break;
        case 'pageup':
          if (tab().list && !st.detail) move(-5);
          else st.scroll -= body - 2;
          break;
        case 'home':
        case 'g':
          if (key.shift || str === 'G') {
            if (tab().list && !st.detail) move(Infinity);
            else st.scroll = Infinity;
          } else if (tab().list && !st.detail) st.sel[tab().id] = 0;
          else st.scroll = 0;
          break;
        case 'end':
          if (tab().list && !st.detail) move(Infinity);
          else st.scroll = Infinity;
          break;
        case 'return':
        case 'enter':
          if (tab().list && listItems().length && focusItems.length) {
            st.detail = true;
            st.scroll = 0;
          }
          break;
        case 'w':
          st.days = nextWindow(st.days);
          reload();
          return;
        case 't':
          st.testers = !st.testers;
          reload();
          return;
        case 'r':
          reload();
          return;
        default:
          if (str === '?') st.help = true;
          else if (/^[1-9]$/.test(str ?? '') && Number(str) <= TABS.length) moveTab(Number(str) - 1);
          else return;
      }
      draw();
    }

    let done = false;
    function restore() {
      if (done) return;
      done = true;
      clearInterval(spinner);
      stdin.off('keypress', onKey);
      stdout.off('resize', draw);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
      stdout.write(`${CSI}0m${CSI}?25h${CSI}?1049l`);
    }
    const onSignal = (signal) => {
      restore();
      process.exit(signal === 'SIGHUP' ? 129 : 143);
    };
    function quit() {
      restore();
      process.off('exit', restore);
      process.off('SIGTERM', onSignal);
      process.off('SIGHUP', onSignal);
      resolve();
    }

    process.on('exit', restore);
    process.on('SIGTERM', onSignal);
    process.on('SIGHUP', onSignal);
    stdout.write(`${CSI}?1049h${CSI}2J`);
    emitKeypressEvents(stdin);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress', onKey);
    stdout.on('resize', draw);
    reload();
  });
}
