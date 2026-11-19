// logic/report.mjs: the summary's rows, a failure's annotation and its result line.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { annotation, details, header, oneline, resultLine, row } from './report.mjs';

describe('report', () => {
  it('writes one table row per check', () => {
    assert.deepEqual(header('codex').slice(-2), ['| Check | | Time | Output |', '|---|---|---|---|']);
    assert.equal(row({ check: 'help: `codex --help`', ok: true, secs: 2, detail: 'has --sandbox' }), '| help: `codex --help` | OK | 2s | has --sandbox |');
    assert.equal(row({ check: 'run', ok: false, secs: 0, detail: 'a|b\n c' }), '| run | **FAIL** | 0s | a\\|b c |');
    assert.equal(oneline('x'.repeat(120)).length, 100);
  });

  it('names the kind, the probe and what is missing in an annotation', () => {
    assert.equal(
      annotation('codex', 'help: `codex --help`', 'missing "--sandbox"\nmore'),
      '::error title=agents-latest codex::codex: help: `codex --help`: missing "--sandbox" more',
    );
    assert.equal(annotation('k', 'run', '100%'), '::error title=agents-latest k::k: run: 100%25');
  });

  it('keeps the end of a failure log, collapsed', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
    const text = details('install', `${lines}\n\`\`\`fence`);
    assert.match(text, /<details><summary>install<\/summary>/);
    assert.ok(!text.includes('line 0\n') && text.includes('line 99'));
    assert.equal(text.match(/```/g).length, 2, 'a fence in the log cannot close ours');
  });

  it('writes one JSON line per check', () => {
    assert.deepEqual(JSON.parse(resultLine('k', { check: 'acp: initialize', ok: true, secs: 3, detail: 'x' })), {
      kind: 'k',
      check: 'acp: initialize',
      ok: true,
      secs: 3,
      detail: 'x',
    });
  });
});
