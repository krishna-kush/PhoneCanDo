// Installing an agent into its machine: the run fold and where its bar
// lands at each stage (src/state/flows/logic/installRun.ts; the bar's
// math in test_install_progress.js), why a run stopped
// (installErrors.ts), the words on the agent page and Home
// (src/ui/env/logic/installText.ts, errorText.ts, hints.ts), and the open
// link prompt's words (src/ui/common/promptQueue.ts). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_agent_install.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
// import() wants a URL: a bare Windows path (C:\...) is not one.
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;
const flows = (p) => src('state/flows/logic', p);
const ui = (p) => src('ui/env/logic', p);

(async () => {
  // --- the run fold -------------------------------------------------------
  const { startRun, applyInstallEvent, tailLines, TAIL_MAX } = await import(flows('installRun.ts'));
  const { START, CHECK_AT, phaseSpans } = await import(flows('installProgress.ts'));
  const fold = (run, events) => events.reduce(applyInstallEvent, run);
  const phases = ['runtime:node', 'packages', 'install', 'verify'];

  const fresh = startRun('install');
  t('a run starts waiting for the machine', [fresh.status, fresh.stage, fresh.phase, fresh.tail], ['running', 'machine', null, []]);
  t('the bar starts a little ahead while waiting for the machine', fresh.fraction, START);
  const planned = fold(fresh, [{ type: 'stage', stage: 'plan' }, { type: 'plan', phases }]);
  t('still there before the script', planned.fraction, START);
  const script = fold(planned, [{ type: 'stage', stage: 'script' }]);
  t('script before its first phase', script.fraction, START);
  const packages = fold(script, [{ type: 'progress', phase: 'packages', tail: ['a', 'b'] }]);
  t('phase and tail land', [packages.phase, packages.tail], ['packages', ['a', 'b']]);
  t('second of four phases starts at its share', packages.fraction, phaseSpans(phases)[1].from);
  const quiet = fold(packages, [{ type: 'progress' }]);
  t('an event without phase or tail keeps both', [quiet.phase, quiet.tail], ['packages', ['a', 'b']]);
  const odd = fold(packages, [{ type: 'progress', phase: 'later', tail: 'x' }]);
  t('a phase the plan does not list keeps the bar where it was', odd.fraction, packages.fraction);
  const verify = fold(packages, [{ type: 'stage', stage: 'verify' }]);
  t('our version check', verify.fraction, CHECK_AT);
  const done = fold(verify, [{ type: 'done', version: '0.12.0' }]);
  t('done', [done.status, done.version, done.fraction], ['done', '0.12.0', 1]);
  t('an ended run ignores later events', fold(done, [{ type: 'stage', stage: 'machine' }, { type: 'failed', failure: { code: 'internal', message: '' } }]), done);
  const failed = fold(packages, [{ type: 'failed', failure: { code: 'command_failed', message: 'exit 100' } }]);
  t('failed keeps where it stopped', [failed.status, failed.stage, failed.phase, failed.failure.code], ['failed', 'script', 'packages', 'command_failed']);
  t('update mode is kept', startRun('update').mode, 'update');

  t('tail from lines', tailLines(['a', 'b']), ['a', 'b']);
  t('tail from text', tailLines('a\nb\r\nc\n\n'), ['a', 'b', 'c']);
  t('tail drops non-strings', tailLines(['a', 1, null, 'b']), ['a', 'b']);
  t('no tail', tailLines(undefined), null);
  const many = Array.from({ length: 30 }, (_, i) => `l${i}`);
  t('tail keeps the last lines', tailLines(many), many.slice(-TAIL_MAX));

  // --- why a run stopped --------------------------------------------------
  const { installFailureOf, scriptFailure, InstallError } = await import(flows('installErrors.ts'));
  const expo = new Error("Call to function 'PhoneCanDoRunner.recordInstall' has been rejected.\n→ Caused by: verify_failed: no version in 'gemini'");
  t('runner code through Expo', installFailureOf(expo), { code: 'verify_failed', message: "no version in 'gemini'" });
  t('runner code field', installFailureOf(Object.assign(new Error('apk unsupported'), { code: 'no_recipe' })), {
    code: 'no_recipe', message: 'apk unsupported',
  });
  t('a leading runner code', installFailureOf(new Error('no_recipe: family xbps')), { code: 'no_recipe', message: 'family xbps' });
  t('a Linux failure', installFailureOf(Object.assign(new Error('job busy'), { code: 'busy' })), { code: 'busy', message: 'job busy' });
  t('our own error', installFailureOf(new InstallError({ code: 'not_found', message: 'its machine is gone' })), {
    code: 'not_found', message: 'its machine is gone',
  });
  t('anything else is internal', installFailureOf(new Error('boom')), { code: 'internal', message: 'boom' });
  t('script ended well', scriptFailure({ ok: true, exitCode: 0, error: null }), null);
  t('script without ok field ended well', scriptFailure({ error: null }), null);
  t('script error line wins', scriptFailure({ ok: false, exitCode: 1, error: 'timed_out: after 1200 s', errorCode: 'timed_out' }), {
    code: 'timed_out', message: 'after 1200 s',
  });
  t('script exit without a line', scriptFailure({ ok: false, exitCode: 100, error: null }), { code: 'command_failed', message: 'exit 100' });

  // --- words --------------------------------------------------------------
  const { phaseLabel, installLine, installFailureText, installDoneLine, versionLine } = await import(ui('installText.ts'));
  t('runtime phase', phaseLabel('runtime:node', 'gemini'), 'Installing Node.js');
  t('unknown runtime by id', phaseLabel('runtime:deno', 'gemini'), 'Installing deno');
  t('packages phase', phaseLabel('packages', 'gemini'), 'Installing system packages');
  t('install phase names the agent', phaseLabel('install', 'gemini'), 'Installing gemini');
  t('verify phase', phaseLabel('verify', 'gemini'), 'Checking the version');
  t('before a phase', phaseLabel(null, 'gemini'), 'Getting ready');
  t('unknown phase reads as words', phaseLabel('post_install', 'gemini'), 'Post install');
  t('machine line', installLine(fresh, 'gemini'), 'Waiting for its machine');
  t('script line', installLine(packages, 'gemini'), 'Installing system packages');
  t('verify line', installLine(verify, 'gemini'), 'Checking the version');
  t('failure says where and why', installFailureText(failed, 'gemini'),
    'The install stopped while installing system packages. A command failed. Its last lines are below.');
  const updateFailed = fold(startRun('update'), [{ type: 'failed', failure: { code: 'busy', message: '' } }]);
  t('update failure', installFailureText(updateFailed, 'gemini'),
    'The update stopped while waiting for its machine. Something else is still running on it. Wait a moment and try again.');
  t('done line', installDoneLine(done, 'gemini'), 'gemini is installed (0.12.0).');
  t('updated line', installDoneLine({ ...done, mode: 'update' }, 'gemini'), 'gemini is up to date (0.12.0).');
  t('nothing to install', installDoneLine({ ...done, version: null }, 'top'), 'top is installed.');
  t('version line', versionLine('0.12.0'), 'Version 0.12.0');

  const { installErrorText, startErrorText, startFailureCode } = await import(ui('errorText.ts'));
  t('no recipe', installErrorText({ code: 'no_recipe', message: 'x' }), "We don't know how to install this agent on this machine's system.");
  t('verify failed', installErrorText({ code: 'verify_failed', message: 'x' }), "It installed, but we couldn't read its version, so it may not run.");
  t('timed out', installErrorText({ code: 'timed_out', message: '' }), 'It took too long, so we stopped it. Check your connection and try again.');
  t('internal keeps the line', installErrorText({ code: 'internal', message: 'boom' }), 'Something went wrong on our side. (boom)');
  t('not installed start code', startFailureCode('start-failed:agent_not_installed'), 'agent_not_installed');
  t('not installed text', startErrorText('agent_not_installed'),
    "This agent isn't installed in its machine yet. Install it on its page: tap its name up top, then its ›.");

  const { agentReinstallLine } = await import(ui('hints.ts'));
  t('reinstall line', agentReinstallLine('gemini'),
    'The reset removed the system packages gemini needs. Reinstall it to bring them back; your projects and chats stay.');

  // --- the open link prompt -----------------------------------------------
  const { urlHost, openUrlTitle, isWebLink } = await import(src('ui/common/promptQueue.ts'));
  t('host of a link', urlHost('https://Accounts.Google.com/o/oauth2?x=1'), 'accounts.google.com');
  t('user info is not the host', urlHost('https://accounts.google.com@evil.example/x'), 'evil.example');
  t('port kept', urlHost('http://localhost:8085/callback'), 'localhost:8085');
  t('host before a query', urlHost('https://example.com?a=b'), 'example.com');
  t('title names agent and host', openUrlTitle({ agentName: 'gemini', url: 'https://github.com/login/device' }), 'gemini wants to open github.com');
  t('title without a name', openUrlTitle({ agentName: '', url: 'https://x.dev/' }), 'An agent wants to open x.dev');
  t('title without a link', openUrlTitle({ agentName: 'gemini', url: null }), 'gemini wants to open a link');
  t('https link', isWebLink('https://x.dev/a'), true);
  t('http link', isWebLink('http://localhost:1/'), true);
  t('intent link refused', isWebLink('intent://scan/#Intent;scheme=zxing;end'), false);
  t('javascript refused', isWebLink('javascript:alert(1)'), false);
  t('no link', isWebLink(undefined), false);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
