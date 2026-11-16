// The scripts that keep a covered web Home out of what you type. While a
// page or the drawer covers Home, the web view keeps Android's input focus
// (React Native has no way to move it), so a key typed on a page with no
// field focused still reached the web page behind it, and opencode's
// composer takes any printable key typed while nothing has focus. The
// guard drops key and text events in the page while it is covered, and
// blurs a field the page focuses meanwhile. Pure (strings only):
// scripts/vectors/test_chat_pages.js runs them.

// Blurs the focused element, inside shadow roots too.
const BLUR = `function () {
    var el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    if (el && el !== document.body && typeof el.blur === 'function') el.blur();
  }`;

/**
 * Installs the guard once per document, uncovered. At document start (with
 * the theme script), so its window listeners come before the page's own,
 * and again from COVER_SCRIPT, where it is a no-op.
 */
export const KEY_GUARD = `(function () {
  if (window.__phonecandoGuard) return;
  var blur = ${BLUR};
  window.__phonecandoGuard = { blur: blur };
  var drop = function (e) {
    if (!window.__phonecandoCovered) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  ['keydown', 'keypress', 'keyup', 'beforeinput', 'paste'].forEach(function (type) {
    window.addEventListener(type, drop, true);
  });
  window.addEventListener('focusin', function () {
    if (window.__phonecandoCovered) blur();
  }, true);
})();`;

/** Home covered: keys reach nothing, and the focused field lets go (which hides the keyboard). */
export const COVER_SCRIPT = `${KEY_GUARD}
window.__phonecandoCovered = true;
window.__phonecandoGuard.blur();
true;`;

/** Home in front again: keys reach the page. Nothing gives a field focus back: a tap does. */
export const UNCOVER_SCRIPT = `window.__phonecandoCovered = false;
true;`;
