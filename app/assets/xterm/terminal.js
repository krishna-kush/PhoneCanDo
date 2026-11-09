(function () {
  // RN hidden TextInput owns the soft keyboard (WebView IME is unreliable on
  // Android Gboard: keyCode 229 composition, buffered onData). The page is
  // render-only: disable stdin, report taps so RN can focus its input.
  //
  // Cursor trick: xterm draws a hollow cursor while blurred, which reads as
  // "unfocused". The helper textarea is set READONLY so it can hold DOM
  // focus (solid cursor) without summoning the soft keyboard — the IME only
  // attaches to editable fields, so the keyboard stays with the RN input.
  // DOM focus (cursor) and Android input focus (keyboard) coexist.
  // Blanks (unfilled pixels, empty cells) must blend with the TUI's own
  // background (#0a0a0a): row math always leaves a rounding remainder and
  // the TUI may trail the PTY by a resize, and pure-black blanks read as a
  // "margin" between the TUI and the keyboard. Never use #000 here.
  var term = new Terminal({
    theme: { background: '#0a0a0a', foreground: '#e6e6e6', cursor: '#00ff00' },
    fontFamily: 'monospace',
    fontSize: 14,
    allowProposedApi: true,
    disableStdin: true,
    // Unfocused cursor renders as a solid block, not hollow: our page never
    // holds window focus steadily (IME interplay), and hollowness reads as
    // "broken". The RN input owns real focus; this is display-only.
    cursorInactiveStyle: 'block'
  });
  var el = document.getElementById('term');

  // Cell source for the fit below. No per-device numbers: xterm measures
  // its own real cell at runtime (same source addon-fit uses), so every
  // phone/tablet font, DPI and ratio yields its own correct rows/cols.
  // Hardcoded 8.4x17 is pre-open fallback only.
  function trueCell() {
    // xterm measures its real cell (font metrics, devicePixelRatio) on open;
    // addon-fit reads it from here. Hardcoded 8.4x17 left a multi-row gap
    // (red band) because the true cell is shorter. Fall back pre-open.
    try {
      var d = term._core && term._core._renderService && term._core._renderService.dimensions;
      var c = d && d.css && d.css.cell;
      if (c && c.width > 4 && c.height > 8) return { w: c.width, h: c.height };
    } catch (e) {}
    return { w: 8.4, h: 17 };
  }

  function measure() {
    // Real pixels minus our own padding (getBoundingClientRect includes it;
    // counting padding as cells overstates the size by ~1 row/col).
    var cs = window.getComputedStyle(el);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var r = el.getBoundingClientRect();
    var cell = trueCell();
    return {
      cols: Math.max(20, Math.floor((r.width - padX) / cell.w)),
      rows: Math.max(10, Math.floor((r.height - padY) / cell.h)),
      pxW: Math.round(r.width),
      pxH: Math.round(r.height)
    };
  }

  var size = measure();
  var lastSent = { cols: 0, rows: 0 };
  term.open(el);
  term.resize(size.cols, size.rows);

  // Every resize after the first, once xterm has parsed what is queued
  // (writes are parsed later, resize() applies at once; write callbacks run
  // in order). xterm sizes the screen around the cursor: getting shorter it
  // drops every row below the cursor first (up to the rows it loses), text
  // or not, and only then scrolls the top into the scrollback; getting
  // taller it pulls the scrollback back down only when nothing is below the
  // cursor, else adds blank rows at the bottom. An inline TUI (Gemini CLI)
  // keeps its cursor on its input line, above its footer, and redraws
  // nothing on a height-only change: its footer was gone for good once the
  // keyboard opened, and closing it left the frame floating over blank
  // rows. So for a resize the cursor stands on the last row with text and
  // goes back to its own line after: the content stays anchored at the
  // bottom, with the top lines to and from the scrollback, as a desktop
  // terminal does. xterm has no API to move the cursor without parsing (a
  // write would let queued program output in between), so this sets its
  // buffer's row directly, as trueCell() reads its render service. Height
  // only: on a width change xterm rewraps the lines, and the program
  // redraws.
  // Text that ends at the bottom (within ANCHOR_GAP rows of the last row:
  // Gemini CLI leaves a blank line under its frame) stays at the bottom,
  // that gap and all: the cursor stands on the last row for the resize, so
  // xterm moves the top to and from the scrollback, and when there is too
  // little scrollback to pull down the blank rows go on top (inserted there,
  // the cursor moved down with its line). Closing the keyboard then leaves
  // an inline TUI's input box right above it, where a phone keeps it. Text
  // that ends higher up (a prompt with blank rows below) stays where it is,
  // the cursor standing on its last row of text.
  //
  // One resize at a time, to the latest size asked for: a burst (one per
  // frame while the keyboard moves) collapses, and a step's own writes are
  // parsed before the next step reads the screen, which it reads to decide
  // where the cursor stands.
  var ANCHOR_GAP = 2;
  var resizing = false;
  var wanted = null;
  function resizeKeeping(cols, rows) {
    wanted = { cols: cols, rows: rows };
    if (!resizing) nextResize();
  }

  function nextResize() {
    resizing = true;
    term.write('', function () {
      var cols = wanted.cols;
      var rows = wanted.rows;
      wanted = null;
      var done = function () {
        if (wanted) nextResize();
        else resizing = false;
      };
      var buf = term._core && term._core.buffer;
      var b = term.buffer.active;
      var heightOnly = !!buf && cols === term.cols && rows !== term.rows && b.type === 'normal';
      var below = 0;
      var atBottom = false;
      if (heightOnly) {
        for (var r = term.rows - 1; r > buf.y; r--) {
          var line = b.getLine(b.baseY + r);
          if (line && line.translateToString(true) !== '') break;
        }
        atBottom = term.rows - 1 - r <= ANCHOR_GAP;
        below = (atBottom ? term.rows - 1 : r) - buf.y;
      }
      var taller = rows - term.rows;
      var baseBefore = b.baseY;
      if (below > 0) buf.y += below;
      term.resize(cols, rows);
      if (below > 0) buf.y = Math.max(0, buf.y - below);
      var short = heightOnly && atBottom && taller > 0 ? taller - (baseBefore - b.baseY) : 0;
      if (short > 0) term.write('\x1b7\x1b[1;1H\x1b[' + short + 'L\x1b8\x1b[' + short + 'B', done);
      else done();
    });
  }

  // xterm's grid follows its box at once: the keyboard resizes the box every
  // frame, and a grid that lagged sat centred in a box of another size, so
  // the screen slid the wrong way and then snapped into place. Only the
  // program waits for the settled size (postSize).
  function fitLocal() {
    var s = measure();
    if (s.cols !== term.cols || s.rows !== term.rows) resizeKeeping(s.cols, s.rows);
  }

  function postSize(why) {
    var s = measure();
    fitLocal();
    if (s.cols !== lastSent.cols || s.rows !== lastSent.rows) {
      lastSent = { cols: s.cols, rows: s.rows };
      var c = trueCell();
      post({ type: 'termsize', cols: s.cols, rows: s.rows, pxW: s.pxW, pxH: s.pxH, why: why, cellW: +c.w.toFixed(2), cellH: +c.h.toFixed(2) });
    }
  }

  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  term.onData(function (data) {
    var bytes = new TextEncoder().encode(data);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    post({ type: 'input', data: btoa(bin) });
  });

  function lockHelperReadonly() {
    try {
      var ta = el.querySelector('.xterm-helper-textarea');
      if (ta) {
        ta.readOnly = true;
        ta.inputMode = 'none';
        ta.setAttribute('readonly', 'readonly');
      }
    } catch (e) {}
  }
  function isHelperFocused() {
    try {
      var ta = el.querySelector('.xterm-helper-textarea');
      return !!ta && document.activeElement === ta;
    } catch (e) { return false; }
  }
  // Re-assert DOM focus: the load-time focus() often lands before the
  // WebView window is focusable and fails silently (nothing retries it),
  // leaving the cursor hollow until the first tap. Readonly focus can never
  // summon the keyboard, so retrying is safe — cheap insurance every 2s.
  function ensureFocus() {
    lockHelperReadonly();
    try {
      if (!isHelperFocused()) term.focus();
    } catch (e) {}
  }
  ensureFocus();
  setTimeout(ensureFocus, 500);
  setInterval(ensureFocus, 2000);
  window.addEventListener('focus', function () { ensureFocus(); });
  document.addEventListener('visibilitychange', function () { ensureFocus(); });
  // Scroll bridge: a swipe or wheel goes where a desktop terminal sends a
  // wheel. A program that asked for mouse reports (opencode's alt-screen
  // TUI) gets wheel reports: RN writes them ('scroll'). One on the
  // alternate screen without them (less, man) gets arrow keys, as xterm's
  // alternate scroll does ('scroll' with as 'arrows'). Anything else (a
  // shell, an inline TUI like Gemini CLI or Claude Code) has our own
  // scrollback, which scrolls here; RN hears 'scrolled' so typing brings
  // the view back down (__toBottom). Direction follows the finger (direct
  // manipulation): swipe down pulls content down and reveals older lines
  // above = scroll up (dir -1); swipe up reveals newer below = dir +1.
  // Pixels accumulate and flush as a step burst per touchmove, so fast
  // swipes travel far and slow ones creep line by line. A tap (touch with
  // no move) posts 'tap' so RN focuses its input — a swipe must NOT summon
  // the keyboard.
  var LINE_PX = 24;
  var touchY = null;
  var touchMoved = false;
  var touchAcc = 0;
  var scrolledUp = false;
  function noteScrolled() {
    var b = term.buffer.active;
    var up = b.viewportY < b.baseY;
    if (up !== scrolledUp) {
      scrolledUp = up;
      post({ type: 'scrolled', up: up });
    }
  }
  function postSteps(dir, steps) {
    if (steps <= 0) return;
    var modes = term.modes;
    if (modes.mouseTrackingMode !== 'none') {
      post({ type: 'scroll', dir: dir, steps: steps, t: Date.now() });
    } else if (term.buffer.active.type === 'alternate') {
      post({ type: 'scroll', dir: dir, steps: steps, t: Date.now(), as: 'arrows', app: modes.applicationCursorKeysMode });
    } else {
      term.scrollLines(dir * steps);
      noteScrolled();
    }
  }
  term.onScroll(function () { noteScrolled(); });
  window.__toBottom = function () {
    term.scrollToBottom();
    noteScrolled();
  };
  // Our own scrollback scrolls under the finger like a native list: a line
  // per cell height of travel (1:1), and a fling keeps it going, slowing
  // down, until it stops or meets an end. A program that scrolls itself
  // keeps LINE_PX steps and no fling: opencode accelerates the wheel itself.
  var FLING_MIN = 0.3; // px/ms: slower lifts just stop
  var FLING_STOP = 0.02; // px/ms
  var FRICTION = 0.997; // velocity kept per ms
  var samples = [];
  var fling = null;
  function localScroll() {
    return term.modes.mouseTrackingMode === 'none' && term.buffer.active.type === 'normal';
  }
  function flushAcc() {
    var px = localScroll() ? trueCell().h : LINE_PX;
    var steps = Math.floor(Math.abs(touchAcc) / px);
    if (steps > 0) {
      if (touchAcc > 0) {
        touchAcc -= steps * px;
        postSteps(-1, steps);
      } else {
        touchAcc += steps * px;
        postSteps(1, steps);
      }
    }
  }
  function stopFling() {
    if (fling) cancelAnimationFrame(fling.raf);
    fling = null;
  }
  // The finger's speed over its last 100 ms, px/ms (down is positive).
  function liftSpeed() {
    var now = Date.now();
    while (samples.length > 1 && now - samples[0].t > 100) samples.shift();
    if (samples.length < 2) return 0;
    var a = samples[0];
    var b = samples[samples.length - 1];
    return b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
  }
  function startFling(v) {
    if (Math.abs(v) < FLING_MIN) return;
    var last = performance.now();
    fling = { v: v, raf: 0 };
    function frame(now) {
      if (!fling) return;
      var dt = Math.min(48, now - last);
      last = now;
      touchAcc += fling.v * dt;
      flushAcc();
      fling.v *= Math.pow(FRICTION, dt);
      var b = term.buffer.active;
      var atEnd = (fling.v > 0 && b.viewportY === 0) || (fling.v < 0 && b.viewportY === b.baseY);
      if (Math.abs(fling.v) < FLING_STOP || atEnd) {
        fling = null;
        return;
      }
      fling.raf = requestAnimationFrame(frame);
    }
    fling.raf = requestAnimationFrame(frame);
  }
  el.addEventListener('touchstart', function (e) {
    ensureFocus();
    stopFling();
    try {
      touchY = e.touches[0].clientY;
    } catch (err) { touchY = null; }
    touchMoved = false;
    touchAcc = 0;
    samples = touchY == null ? [] : [{ t: Date.now(), y: touchY }];
  }, { passive: true });
  el.addEventListener('touchmove', function (e) {
    if (touchY == null) return;
    try {
      var y = e.touches[0].clientY;
      var dy = y - touchY;
      touchY = y;
      if (Math.abs(dy) > 2) touchMoved = true;
      touchAcc += dy;
      samples.push({ t: Date.now(), y: y });
      if (samples.length > 20) samples.shift();
      flushAcc();
    } catch (err) {}
  }, { passive: true });
  el.addEventListener('touchend', function () {
    if (!touchMoved) post({ type: 'tap' });
    else if (localScroll()) startFling(liftSpeed());
    touchY = null;
  }, { passive: true });
  // A sideways swipe the tab pager took over (DirectionLockView): neither a
  // tap nor a fling.
  el.addEventListener('touchcancel', function () {
    touchY = null;
    touchAcc = 0;
  }, { passive: true });
  el.addEventListener('wheel', function (e) {
    // Desktop/emulator wheel: same bridge. preventDefault keeps the page
    // from rubber-banding; alt-screen has no scrollback to move. Wheel down
    // moves content up, revealing newer below = dir +1 (same as swipe up).
    try { e.preventDefault(); } catch (err) {}
    var steps = Math.min(8, Math.max(1, Math.round(Math.abs(e.deltaY) / 50)));
    postSteps(e.deltaY > 0 ? 1 : -1, steps);
  }, { passive: false });
  el.addEventListener('mousedown', function () {
    ensureFocus();
    post({ type: 'tap' });
  });

  window.__writeB64 = function (b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    term.write(bytes);
  };

  window.__resize = function (cols, rows) {
    resizeKeeping(cols, rows);
  };

  // A replay (a TUI engine's screen so far) must be parsed at the size it
  // was drawn at: resizeKeeping waits for every write queued before it.
  window.__resizeAfterWrites = function (cols, rows) {
    resizeKeeping(cols, rows);
  };

  // The title the program sets (OSC 0/2). A TUI names what it shows there;
  // RN reads it (opencode: the chat on screen).
  term.onTitleChange(function (title) {
    post({ type: 'title', title: String(title || '').slice(0, 200) });
  });

  var __cell0 = trueCell();
  post({ type: 'ready', cols: size.cols, rows: size.rows, pxW: size.pxW, pxH: size.pxH, cellW: +__cell0.w.toFixed(2), cellH: +__cell0.h.toFixed(2) });
  lastSent = { cols: size.cols, rows: size.rows };

  // Single source of truth for PTY size: the page's own pixels. Layout
  // moves under us (the keyboard animates it every frame), and one-shot
  // measurements + event math chronically disagree with the final layout.
  // The grid follows every change (fitLocal); only the settled size crosses
  // the bridge to the program: each layout change restarts a quiet window,
  // and only actual cell-count changes are sent. An inline TUI (Gemini CLI)
  // handed a passing size draws itself off the bottom of the screen.
  var roTimer = null;
  var SETTLE_MS = 120;
  function observeSize() {
    if (typeof ResizeObserver === 'undefined') return;
    try {
      var ro = new ResizeObserver(function () {
        fitLocal();
        if (roTimer) clearTimeout(roTimer);
        roTimer = setTimeout(function () {
          roTimer = null;
          postSize('ro');
        }, SETTLE_MS);
      });
      ro.observe(el);
    } catch (e) {}
  }
  observeSize();
})();
