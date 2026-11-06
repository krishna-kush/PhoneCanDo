import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchPath } from '../op.ts';
import { LIMITS } from '../schema/limits.ts';
import { cronOps, httpOps, ops } from './registry.ts';

describe('registry', () => {
  it('lists the shared routes with their body caps', () => {
    assert.deepEqual(
      httpOps.map((op) => [op.method, op.path, op.name, op.maxBodyBytes]),
      [
        ['POST', '/v1/batch', 'batch', LIMITS.batchBodyBytes],
        ['POST', '/v1/hit', 'hit', LIMITS.smallBodyBytes],
        ['GET', '/v1/dl/:channel', 'download', 0],
        ['POST', '/v1/report', 'report', LIMITS.reportBodyBytes],
        ['POST', '/v1/forget', 'forget', LIMITS.smallBodyBytes],
        ['GET', '/v1/health', 'health', 0],
      ],
    );
    assert.ok(httpOps.every((op) => op.kind === 'http'));
  });

  it('lists the shared crons (UTC); retention is not scheduled while we keep all data', () => {
    assert.deepEqual(
      cronOps.map((op) => [op.name, op.schedule]),
      [['github_daily', '17 3 * * *']],
    );
    assert.ok(cronOps.every((op) => op.kind === 'cron'));
  });

  it('degrades only the routes that must answer without a write (page views, download redirects)', () => {
    assert.deepEqual(
      httpOps.map((op) => [op.name, op.whenLimited ?? 'reject']),
      [
        ['batch', 'reject'],
        ['hit', 'degrade'],
        ['download', 'degrade'],
        ['report', 'reject'],
        ['forget', 'reject'],
        ['health', 'reject'],
      ],
    );
  });

  it('has unique names and no overlapping routes', () => {
    assert.equal(new Set(ops.map((op) => op.name)).size, ops.length);
    assert.equal(ops.length, httpOps.length + cronOps.length);
    for (const a of httpOps) {
      for (const b of httpOps) {
        if (a !== b && a.method === b.method) assert.equal(matchPath(a.path, b.path.replace(/:\w+/g, 'x')), null, `${a.path} vs ${b.path}`);
      }
    }
    assert.deepEqual(matchPath('/v1/dl/:channel', '/v1/dl/lite'), { channel: 'lite' });
  });
});
