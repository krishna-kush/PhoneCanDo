// The look's promises: every role becomes the var name the website uses,
// and Daylight is the site's light theme.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import tokens from '../../../theme/tokens.json' with { type: 'json' };
import { alpha, mix } from './color.ts';
import { DAY, varsOf } from './look.ts';

test('roles become the site var names', () => {
  const vars = varsOf(DAY);
  for (const name of ['--bg', '--panel-2', '--line-2', '--red-hi', '--on-primary', '--accent-ink', '--grid']) assert.ok(name in vars, name);
  assert.equal(Object.keys(vars).length, Object.keys(DAY.palette).length);
});

test('Daylight is the light theme', () => {
  assert.equal(DAY.palette.bg, tokens.light.bg);
  assert.equal(DAY.palette.red, tokens.light.primary);
  assert.equal(DAY.palette.accent, tokens.light.secondary);
});

test('colours mix and fade', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(alpha('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)');
});
