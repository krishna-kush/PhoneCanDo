import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLog, signedOff, unsigned } from './rules.mjs';

const record = (sha, body) => `${sha}\x1fA Person\x1fa@example.com\x1f${body}\x1e`;

test('a Signed-off-by line with a name and an email signs a commit off', () => {
  assert.ok(signedOff('Fix a thing\n\nSigned-off-by: A Person <a@example.com>\n'));
  assert.ok(signedOff('Fix a thing\n\nCo-authored-by: B <b@x.y>\nsigned-off-by: A <a@x.y>'));
});

test('no line, one without an email, or one inside a sentence does not', () => {
  assert.ok(!signedOff('Fix a thing\n'));
  assert.ok(!signedOff('Fix a thing\n\nSigned-off-by: A Person\n'));
  assert.ok(!signedOff('Fix a thing\n\nSigned-off-by: <a@example.com>\n'));
  assert.ok(!signedOff('Says Signed-off-by: A <a@x.y> mid-line\n'));
});

test('parseLog reads git log records and unsigned lists the bare ones', () => {
  const commits = parseLog(`${record('aaa', 'One\n\nSigned-off-by: A <a@x.y>\n')}\n${record('bbb', 'Two\n')}\n`);
  assert.deepEqual(commits.map((commit) => commit.sha), ['aaa', 'bbb']);
  assert.equal(commits[0].email, 'a@example.com');
  assert.deepEqual(unsigned(commits).map((commit) => commit.sha), ['bbb']);
  assert.deepEqual(parseLog(''), []);
});
