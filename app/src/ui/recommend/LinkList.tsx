import type { LinkStats } from '../../engine/share/stats';
import type { ShareLink } from '../../state/logic/share/list';
import AppCard from '../common/AppCard';
import PlainText from '../common/PlainText';
import { NO_LINKS } from './copy';
import { linkLine, linkTitle, sentLabel } from './logic/funnel';

// Every link this phone (or the account) sent, newest first: the app it
// went through, when, and what it did.
export default function LinkList({ links, stats }: { links: ShareLink[]; stats: Record<string, LinkStats> }) {
  if (links.length === 0) {
    return (
      <PlainText fontSize={14} color="muted">
        {NO_LINKS}
      </PlainText>
    );
  }
  const now = Date.now();
  return (
    <>
      {links.map((l) => (
        <AppCard
          key={l.code ?? `untracked-${l.at}`}
          title={linkTitle(l)}
          subtitle={linkLine(l, l.code ? stats[l.code] : undefined)}
          chevron={false}
        >
          <PlainText fontFamily="mono" fontSize={11} color="secondaryInk" numberOfLines={1}>
            {l.code ? `${sentLabel(l.at, now)} · /i/${l.code}` : sentLabel(l.at, now)}
          </PlainText>
        </AppCard>
      ))}
    </>
  );
}
