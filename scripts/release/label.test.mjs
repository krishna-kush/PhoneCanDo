import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseLabel, releaseTitle } from './label.mjs';

test('no --label, or --label stable: no label', () => {
  assert.equal(releaseLabel(undefined), null);
  assert.equal(releaseLabel('stable'), null);
});

test('--label alpha or beta: that label', () => {
  assert.equal(releaseLabel('alpha'), 'alpha');
  assert.equal(releaseLabel('beta'), 'beta');
});

test('any other --label is refused', () => {
  assert.throws(() => releaseLabel('rc'), /--label must be one of alpha, beta, stable/);
  assert.throws(() => releaseLabel(''), /--label/);
});

test('the title carries the label only when there is one', () => {
  assert.equal(releaseTitle('v1.0.0', null), 'v1.0.0');
  assert.equal(releaseTitle('v1.0.0', 'beta'), 'v1.0.0 (beta)');
  assert.equal(releaseTitle('v1.1.0', 'alpha'), 'v1.1.0 (alpha)');
});
