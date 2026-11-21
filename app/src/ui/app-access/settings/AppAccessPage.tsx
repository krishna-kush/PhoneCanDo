import { useState } from 'react';
import type { AppAccessApp } from '../../../engine/appAccess';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Note from '../../env/parts/Note';
import { ALWAYS_GROUP, APPS_TITLE, BLOCKED_GROUP, CHANGE_HINT, NONE_ALWAYS, NONE_BLOCKED, PAGE_INTRO, PAGE_KICKER } from '../copy';
import type { AppTarget } from '../logic/choices';
import { splitApps } from '../logic/layout';
import { useAppAccess } from '../useAppAccess';
import AnsweredBox from './AnsweredBox';
import AppChoiceDialog from './AppChoiceDialog';
import FrontDesk from './FrontDesk';

// Settings → Phone control → Apps: A-04 at the front desk over the Allow
// all apps switch, then every app answered Always or No, for every agent,
// in two key boxes, each app by name and with its own icon. A tap on an app
// opens its pop-up to change it or have it asked again. Opened from the
// Phone control panel's Apps row, which only full builds show.
export default function AppAccessPage() {
  const access = useAppAccess();
  const [open, setOpen] = useState<AppAccessApp | null>(null);
  const { always, blocked } = splitApps(access.apps);
  const openApp = (app: AppAccessApp) => (access.busy ? undefined : setOpen(app));

  // The pop-up goes first, so the fingerprint prompt is the only thing up.
  function pick(to: AppTarget) {
    const app = open;
    setOpen(null);
    if (app) void access.change(app, to);
  }

  return (
    <Screen>
      <PageHeader kicker={PAGE_KICKER} title={APPS_TITLE} />
      <Note>{PAGE_INTRO}</Note>
      <FrontDesk on={access.allowAll} busy={access.busy} onToggle={() => void access.setAllowAll(!access.allowAll)} />
      {/* Why the last change did not go through, the switch's or an app's. */}
      {access.msg ? <Note tone="error">{access.msg}</Note> : null}
      <AnsweredBox title={ALWAYS_GROUP} barcode="alwaysApps" apps={always} none={NONE_ALWAYS} onOpen={openApp} />
      <AnsweredBox title={BLOCKED_GROUP} barcode="blockedApps" apps={blocked} none={NONE_BLOCKED} onOpen={openApp} />
      {access.apps.length > 0 ? <Note>{CHANGE_HINT}</Note> : null}
      <AppChoiceDialog app={open} onPick={pick} onClose={() => setOpen(null)} />
    </Screen>
  );
}
