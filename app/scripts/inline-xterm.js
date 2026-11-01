// Bundles xterm dist into one self-contained asset. The xterm source is
// embedded as base64: the base64 alphabet cannot contain "</script", so this
// is immune to the inline-script-termination class of bugs. Page logic lives
// in terminal.js (lintable source); the bundle inlines it verbatim.
// Re-run on @xterm/xterm bumps or terminal.js changes:
//   node scripts/inline-xterm.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'xterm');
const js = fs.readFileSync(path.join(dir, 'xterm.js'));
const css = fs.readFileSync(path.join(dir, 'xterm.css'), 'utf8');
const page = fs.readFileSync(path.join(dir, 'terminal.js'), 'utf8');
let html = fs.readFileSync(path.join(dir, 'terminal.html'), 'utf8');

html = html
  .replace('<!--XTERM_CSS-->', `<style>${css}</style>`)
  .replace('%%XTERM_B64_PAYLOAD%%', js.toString('base64'))
  .replace('//TERMINAL_JS', () => page);

fs.writeFileSync(path.join(dir, 'terminal.bundle.html'), html);
console.log('wrote terminal.bundle.html', html.length, 'bytes');
