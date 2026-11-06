// report(): its events, note and log tail, the body cap, and refused or
// foreign answers.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import type { ReportRequest } from '../core/schema/wire.ts';
import { setup, UUID } from './harness.ts';
import { REPORT_EVENTS_FLOOR } from './report-body.ts';
import { utf8Length } from './sanitize.ts';

describe('report', () => {
  it('sends the last 50 events oldest first, the note and a redacted log tail', async () => {
    const { client, net } = setup();
    await client.init();
    const sid = client.startSession();
    for (let i = 0; i < 250; i++) client.track('chat.open', { i });
    await client.flush();
    client.track('terminal.open');
    net.reply({ status: 200, body: { reportId: 'r-1', serverTime: 9 } });
    const r = await client.report({ note: '  it broke at /sdcard/x  ', logTail: 'boom at /data/user/0/app/f.log\n' });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { reportId: 'r-1', serverTime: 9 });
    const req = net.to('/v1/report')[0]!.json as ReportRequest;
    assert.equal(req.schema, 1);
    assert.match(req.reportId, UUID);
    assert.equal(req.sessionId, sid);
    assert.equal(req.events.length, LIMITS.reportEvents);
    assert.equal(req.events.at(-1)!.name, 'terminal.open');
    assert.deepEqual(req.events.slice(0, 2).map((e) => e.props?.i), [201, 202]);
    assert.equal(req.note, 'it broke at <path>');
    assert.equal(req.logTail, 'boom at <path>\n');
    assert.equal(req.device.model, 'Pixel 9');
  });

  it('stays under the report body cap', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    for (let i = 0; i < 200; i++) client.track('chat.open', { a: 'x'.repeat(200), b: 'y'.repeat(200) });
    await client.report({ logTail: 'L'.repeat(40_000) });
    const body = net.to('/v1/report')[0]!.body;
    assert.ok(utf8Length(body) <= LIMITS.reportBodyBytes, `report ${utf8Length(body)} bytes`);
    const req = JSON.parse(body) as ReportRequest;
    assert.ok(req.events.length >= REPORT_EVENTS_FLOOR, `${req.events.length} events`);
    assert.ok(req.logTail && req.logTail.length > 0);
  });

  it('is refused while off, without a request', async () => {
    const { client, net } = setup();
    await client.init();
    await client.setEnabled(false);
    const r = await client.report({ note: 'x' });
    assert.ok(!r.ok && r.error.code === 'forbidden');
    assert.equal(net.sent.length, 0);
  });

  it('returns the server error when the report is refused', async () => {
    const { client, net } = setup();
    await client.init();
    net.reply({ status: 413, body: { error: { code: 'too_large', message: 'big' } } });
    const r = await client.report({});
    assert.ok(!r.ok && r.error.code === 'too_large');
  });

  it('calls a 2xx that is not a report response not delivered, so it can be sent again', async () => {
    for (const reply of [
      { status: 200, body: '<html>portal</html>' },
      { status: 200, body: {} },
      { status: 200, body: { reportId: 5, serverTime: 1 } },
      { status: 204 },
    ]) {
      const what = JSON.stringify(reply);
      const { client, net } = setup();
      await client.init();
      client.startSession();
      net.reply(reply);
      const r = await client.report({ note: 'n' });
      assert.ok(!r.ok && r.error.code === 'unavailable', what);
      const again = await client.report({ note: 'n' });
      assert.ok(again.ok, what);
      assert.equal(again.value.reportId, net.to('/v1/report')[1]!.json.reportId, what);
    }
  });
});
