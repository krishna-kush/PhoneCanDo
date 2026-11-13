// Telling a friend, step by step. Sharing: a tracked link gets a fresh
// code while usage stats are on (in a debug build, only with the local dev
// host), the share sheet opens, and only a pick keeps the link (with the
// picked app's label, which stays here), tells the server through the
// usage stats (`share.sent`) and joins it to the account. Reading what the
// links did. And the friend's side: the app opened through a link soon
// after its first install counts once as an install from it (`share.install`).
import { firstInstallTime } from '../../engine/runner';
import { randomBytes } from '../../engine/share/random';
import { fetchShareStats } from '../../engine/share/stats';
import { shareText } from '../../engine/sharing';
import { track } from '../../engine/telemetry';
import { useAppStore } from '../app';
import { codeFromBytes, CODE_LENGTH } from '../logic/share/code';
import { codeFromUrl, countsAsInstall, shareLinkFor } from '../logic/share/link';
import { trackedCodes } from '../logic/share/list';
import { useShareStore } from '../share';
import { syncLinksWithAccount } from './account';

/** Usage stats can carry a link's code to the server right now. */
export function linksTracked(): boolean {
  const t = useAppStore.getState().telemetry;
  return t.available && t.ready && t.enabled && (!__DEV__ || t.devLocal);
}

/** Our API host is the one this build reads counts from (a debug build: the local dev host, when on). */
function statsReachable(): boolean {
  return !__DEV__ || useAppStore.getState().telemetry.devLocal;
}

function newCode(): string | null {
  const bytes = randomBytes(CODE_LENGTH);
  return bytes ? codeFromBytes(bytes) : null;
}

export type ShareResult = { shared: boolean; tracked: boolean };

/** Opens the share sheet with `message(link)`; a sheet that fails to open counts as not shared. */
export async function shareLink(title: string, message: (link: string) => string): Promise<ShareResult> {
  await useShareStore.getState().hydrate();
  const code = linksTracked() ? newCode() : null;
  let picked;
  try {
    picked = await shareText(message(shareLinkFor(code)), title);
  } catch {
    return { shared: false, tracked: false };
  }
  if (!picked.chosen) return { shared: false, tracked: false };
  useShareStore.getState().addLink({ code, at: Date.now(), app: picked.app });
  if (code) {
    track('share.sent', { code });
    void syncLinksWithAccount();
  }
  return { shared: true, tracked: code != null };
}

/** Reads what every tracked link did. */
export async function refreshShareStats(): Promise<void> {
  const store = useShareStore.getState();
  await store.hydrate();
  if (store.statsStatus === 'loading' || !statsReachable()) return;
  const codes = trackedCodes(useShareStore.getState().links);
  if (codes.length === 0) {
    useShareStore.getState().setStats({}, Date.now());
    return;
  }
  useShareStore.getState().setStatsStatus('loading');
  const stats = await fetchShareStats(codes);
  if (stats) useShareStore.getState().setStats(stats, Date.now());
  else useShareStore.getState().setStatsStatus('failed');
}

/** The app was opened with `url`: a friend's link soon after install counts once. */
export async function countShareInstall(url: string | null): Promise<void> {
  const code = codeFromUrl(url);
  if (!code || !linksTracked()) return;
  const store = useShareStore.getState();
  await store.hydrate();
  const { links, installCounted } = useShareStore.getState();
  const counts = countsAsInstall({
    code,
    own: trackedCodes(links),
    firstInstallAt: firstInstallTime(),
    now: Date.now(),
    counted: installCounted,
  });
  if (!counts) return;
  track('share.install', { code });
  useShareStore.getState().markInstallCounted();
}
