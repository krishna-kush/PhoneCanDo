import { useAppStore } from '../../../state/app';
import LinkRow from '../../common/LinkRow';
import { APPS_NOTE, APPS_TITLE, appsNow } from '../copy';
import { useAppAccess } from '../useAppAccess';

// Settings → Phone control's Apps row, under the lock: which apps agents may
// use, and how that stands now (Allow all apps, the apps answered Always or
// No). Opens the Apps page. Nothing in builds that never ask (lite, play,
// native builds from before app access).
export default function AppsRow() {
  const push = useAppStore((s) => s.push);
  const { available, allowAll, apps } = useAppAccess();
  if (!available) return null;
  return (
    <LinkRow
      label={APPS_TITLE}
      note={APPS_NOTE}
      now={appsNow(allowAll, apps)}
      onPress={() => push({ name: 'app-access' })}
    />
  );
}
