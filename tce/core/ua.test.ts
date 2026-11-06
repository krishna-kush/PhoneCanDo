import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UA } from '../testkit/fixtures.ts';
import { cleanPath, refHost } from './referrer.ts';
import { androidMajor, uaClass } from './ua.ts';

describe('uaClass', () => {
  it('classifies the common browsers', () => {
    assert.equal(uaClass(UA.android), 'android');
    assert.equal(uaClass(UA.ios), 'ios');
    assert.equal(uaClass('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'ios');
    assert.equal(uaClass(UA.desktop), 'desktop');
    assert.equal(uaClass('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)'), 'desktop');
    assert.equal(uaClass('Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0'), 'desktop');
    assert.equal(uaClass('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)'), 'desktop');
    assert.equal(uaClass(UA.other), 'other');
    assert.equal(uaClass(null), 'other');
    assert.equal(uaClass(''), 'other');
  });

  it('checks bots first, case-insensitively', () => {
    for (const ua of [
      UA.bot,
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) Chrome/141 Mobile Safari/537.36 (compatible; Googlebot/2.1)',
      'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/141.0.0.0',
      'curl/8.10.1',
      'Wget/1.24',
      'python-requests/2.32',
      'Apache-HttpClient/4.5',
      'Mozilla/5.0 (compatible; Chrome-Lighthouse)',
      'facebookexternalhit/1.1 (+preview)',
      'UptimeRobot/2.0 monitor',
      'Mozilla/5.0 (compatible; bingbot/2.0; Slurp)',
      'Baiduspider',
      'Applebot-crawler',
    ]) {
      assert.equal(uaClass(ua), 'bot', ua);
    }
  });
});

describe('androidMajor', () => {
  it('reads the major version', () => {
    assert.equal(androidMajor(UA.android), 16);
    assert.equal(androidMajor('Mozilla/5.0 (Linux; Android 4.4.2; GT-I9505)'), 4);
    assert.equal(androidMajor(UA.desktop), null);
    assert.equal(androidMajor(null), null);
    assert.equal(androidMajor('Android 0'), null);
  });
});

describe('refHost', () => {
  it('keeps the lowercased host of a foreign referrer', () => {
    assert.equal(refHost('https://News.YCombinator.com/item?id=1', 'phonecando.tarf.app'), 'news.ycombinator.com');
    assert.equal(refHost('http://localhost:3000/x', 'phonecando.tarf.app'), 'localhost');
  });

  it('is null for missing, unparsable and same-host referrers', () => {
    assert.equal(refHost(undefined, 'a.example'), null);
    assert.equal(refHost(null, 'a.example'), null);
    assert.equal(refHost('', 'a.example'), null);
    assert.equal(refHost('::not a url', 'a.example'), null);
    assert.equal(refHost('https://a.example/page', 'a.example'), null);
    assert.equal(refHost('https://A.example/page', 'a.example'), null);
    assert.equal(refHost('http://127.0.0.1:8787/x', '127.0.0.1:8787'), null);
    assert.equal(refHost('mailto:someone@example.com', 'a.example'), null);
  });

  it('keeps the host when the request host is unknown', () => {
    assert.equal(refHost('https://a.example/', null), 'a.example');
  });
});

describe('cleanPath', () => {
  it('drops query and fragment and requires a leading slash', () => {
    assert.equal(cleanPath('/a/b?x=1#y'), '/a/b');
    assert.equal(cleanPath('/#z'), '/');
    assert.equal(cleanPath('a/b'), null);
    assert.equal(cleanPath(''), null);
  });
});
