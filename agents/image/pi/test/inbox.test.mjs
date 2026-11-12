// The pi extension's inbox reader (config/inbox.ts) against a folder laid
// out as the runner lays it out: what it claims, the receipt it writes,
// and that a set goes to one reader only.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claim, peek } from '../config/inbox.ts';

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function folder() {
  const dir = mkdtempSync(join(tmpdir(), 'pi-inbox-'));
  made.push(dir);
  return dir;
}

function inbox({ wake = false, txt = true } = {}) {
  const dir = folder();
  const pending = join(dir, 'pending');
  mkdirSync(pending);
  writeFileSync(join(pending, 'ids'), '12\n13\n');
  if (txt) writeFileSync(join(pending, 'messages.txt'), '<agent-message id="12">a</agent-message>\n');
  writeFileSync(
    join(pending, 'messages.jsonl'),
    `${JSON.stringify({ id: 12, block: 'block 12' })}\n${JSON.stringify({ id: 13, block: 'block 13' })}\n`,
  );
  if (wake) writeFileSync(join(pending, 'wake'), '');
  return dir;
}

test('peek: nothing waiting, waiting, waiting with the wake mark', () => {
  const empty = folder();
  assert.deepEqual(peek(empty), { waiting: false, wake: false });
  assert.deepEqual(peek(inbox()), { waiting: true, wake: false });
  assert.deepEqual(peek(inbox({ wake: true })), { waiting: true, wake: true });
});

test('claim takes the set, writes the receipt and leaves nothing behind', () => {
  const dir = inbox({ wake: true });
  const events = join(dir, 'events');
  const c = claim(dir, events);
  assert.deepEqual(c, { ids: ['12', '13'], text: '<agent-message id="12">a</agent-message>', wake: true });
  assert.equal(readFileSync(events, 'utf8'), '@inbox\t12 13\n');
  assert.deepEqual(readdirSync(dir).sort(), ['events']);
});

test('a second claim gets nothing', () => {
  const dir = inbox();
  assert.ok(claim(dir, undefined));
  assert.equal(claim(dir, undefined), null);
});

test('without messages.txt the rendered blocks of messages.jsonl go', () => {
  const c = claim(inbox({ txt: false }), undefined);
  assert.equal(c?.text, 'block 12\n\nblock 13');
});

test('no events file to write: still claimed', () => {
  const dir = inbox();
  const c = claim(dir, join(dir, 'missing', 'events'));
  assert.deepEqual(c?.ids, ['12', '13']);
  assert.equal(existsSync(join(dir, 'pending')), false);
});
