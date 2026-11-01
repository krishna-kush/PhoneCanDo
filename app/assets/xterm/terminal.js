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

  function postSize(why) {
    var s = measure();
    if (s.cols !== lastSent.cols || s.rows !== lastSent.rows) {
      lastSent = { cols: s.cols, rows: s.rows };
      term.resize(s.cols, s.rows);
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
  // Scroll bridge: the TUI owns its viewport (alt-screen, no xterm
  // scrollback), so swipes/wheel must become keypresses. Direction follows
  // the finger (direct manipulation): swipe down pulls content down and
  // reveals older messages above = scroll up (dir -1); swipe up reveals
  // newer below = dir +1. Smoothness comes from line steps
  // (session.line.up/down = ctrl+alt+y / ctrl+alt+e, a line each) instead
  // of page steps (half a viewport per press = jumpy). Pixels accumulate
  // and flush as a step burst per touchmove, so fast swipes travel far and
  // slow ones creep line by line. A tap (touch with no move) posts 'tap'
  // so RN focuses its input — a swipe must NOT summon the keyboard.
  var LINE_PX = 24;
  var touchY = null;
  var touchMoved = false;
  var touchAcc = 0;
  function postSteps(dir, steps) {
    if (steps > 0) post({ type: 'scroll', dir: dir, steps: steps, t: Date.now() });
  }
  function flushAcc() {
    var steps = Math.floor(Math.abs(touchAcc) / LINE_PX);
    if (steps > 0) {
      if (touchAcc > 0) {
        touchAcc -= steps * LINE_PX;
        postSteps(-1, steps);
      } else {
        touchAcc += steps * LINE_PX;
        postSteps(1, steps);
      }
    }
  }
  el.addEventListener('touchstart', function (e) {
    ensureFocus();
    try {
      touchY = e.touches[0].clientY;
    } catch (err) { touchY = null; }
    touchMoved = false;
    touchAcc = 0;
  }, { passive: true });
  el.addEventListener('touchmove', function (e) {
    if (touchY == null) return;
    try {
      var y = e.touches[0].clientY;
      var dy = y - touchY;
      touchY = y;
      if (Math.abs(dy) > 2) touchMoved = true;
      touchAcc += dy;
      flushAcc();
    } catch (err) {}
  }, { passive: true });
  el.addEventListener('touchend', function () {
    if (!touchMoved) post({ type: 'tap' });
    touchY = null;
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
    term.resize(cols, rows);
  };

  var __cell0 = trueCell();
  post({ type: 'ready', cols: size.cols, rows: size.rows, pxW: size.pxW, pxH: size.pxH, cellW: +__cell0.w.toFixed(2), cellH: +__cell0.h.toFixed(2) });
  lastSent = { cols: size.cols, rows: size.rows };

  // Single source of truth for PTY size: the page's own pixels. Layout
  // moves under us (keyboard animation, footer hide, pad), and one-shot
  // measurements + event math chronically disagree with the final layout.
  // ResizeObserver reports the settled size; only actual cell-count changes
  // cross the bridge (150ms trailing throttle).
  var roTimer = null;
  function observeSize() {
    if (typeof ResizeObserver === 'undefined') return;
    try {
      var ro = new ResizeObserver(function () {
        if (roTimer) return;
        roTimer = setTimeout(function () {
          roTimer = null;
          postSize('ro');
        }, 150);
      });
      ro.observe(el);
    } catch (e) {}
  }
  observeSize();
})();
