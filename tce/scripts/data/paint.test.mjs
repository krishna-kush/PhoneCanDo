import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ago, bar, clip, colorWanted, compact, fit, makeStyle, ms, num, pad, percent, plural, resample, sideBySide, sparkline, stripAnsi, table, width, wrap } from './paint.mjs';

const plain = makeStyle(false);
const color = makeStyle(true);

test('styles are the identity without colour', () => {
  assert.equal(plain.bold('x'), 'x');
  assert.equal(color.bold('x'), '\x1b[1mx\x1b[22m');
  assert.equal(stripAnsi(color.accent(color.bold('hi'))), 'hi');
});

test('colorWanted: TTY, NO_COLOR and FORCE_COLOR', () => {
  assert.equal(colorWanted({ isTTY: true }, {}), true);
  assert.equal(colorWanted({ isTTY: false }, {}), false);
  assert.equal(colorWanted({ isTTY: true }, { NO_COLOR: '' }), false);
  assert.equal(colorWanted({ isTTY: false }, { FORCE_COLOR: '1' }), true);
  assert.equal(colorWanted({ isTTY: true }, { TERM: 'dumb' }), false);
});

test('fit, pad and clip measure visible width', () => {
  assert.equal(fit('abcdef', 4), 'abc…');
  assert.equal(fit('abc', 4), 'abc');
  assert.equal(width(pad(color.bold('ab'), 5)), 5);
  assert.equal(pad('7', 3, 'right'), '  7');
  const cut = clip(`${color.accent('abcdef')}ghi`, 4);
  assert.equal(stripAnsi(cut), 'abcd');
  assert.ok(cut.endsWith('\x1b[0m'));
});

test('numbers, shares, durations and ages', () => {
  assert.equal(num(1234567), '1,234,567');
  assert.equal(num(null), '–');
  assert.equal(compact(9999), '9,999');
  assert.equal(compact(12_345), '12.3k');
  assert.equal(compact(2_500_000), '2.5M');
  assert.equal(percent(1, 3), '33%');
  assert.equal(percent(1, 200), '0.5%');
  assert.equal(percent(1, 0), '–');
  assert.equal(ms(450), '450 ms');
  assert.equal(ms(3450), '3.5 s');
  assert.equal(ago(1000, 1000 + 3 * 3_600_000), '3 h ago');
  assert.equal(ago(0, 5), '–');
  assert.equal(ago(1, 1 + 3_600_000), '1 h ago');
  assert.equal(ago(1, 1 + 600_000), '10 min ago');
  assert.equal(plural(1, 'device'), '1 device');
  assert.equal(plural(1200, 'device'), '1,200 devices');
});

test('bars in eighths, sparklines and resampling', () => {
  assert.equal(bar(10, 10, 4), '████');
  assert.equal(bar(5, 10, 4), '██');
  assert.equal(bar(1, 10, 4), '▍');
  assert.equal(bar(0, 10, 4), '');
  assert.equal(sparkline([0, 1, 2, 4]), '▁▃▅█');
  assert.equal(sparkline([0, 0]), '▁▁');
  const r = resample([1, 2, 3, 4, 5, 6, 7], 3);
  assert.equal(r.length, 3);
  assert.equal(r.reduce((a, b) => a + b), 28);
});

test('table shrinks text columns to fit, never numbers', () => {
  const lines = table(['Name', 'Count'], [['a very long label that does not fit', '1,234']], { w: 30, style: plain, align: ['left', 'right'] });
  assert.ok(lines.every((l) => width(l) <= 30), lines.join('\n'));
  assert.match(lines[2], /1,234$/);
});

test('sideBySide joins blocks that fit and stacks the rest', () => {
  const a = { w: 10, lines: ['a1', 'a2'] };
  const b = { w: 10, lines: ['b1'] };
  assert.deepEqual(sideBySide([a, b], 30), ['a1          b1', 'a2']);
  assert.deepEqual(sideBySide([a, b], 15), ['a1', 'a2', '', 'b1']);
});

test('wrap keeps words and hard-cuts the long ones', () => {
  assert.deepEqual(wrap('one two three', 7), ['one two', 'three']);
  assert.deepEqual(wrap('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrap('a\nb', 10), ['a', 'b']);
});
