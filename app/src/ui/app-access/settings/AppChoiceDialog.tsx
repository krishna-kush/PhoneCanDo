import { XStack, YStack } from 'tamagui';
import type { AppAccessApp } from '../../../engine/appAccess';
import DeckKeys from '../../common/actions/DeckKeys';
import PlainText from '../../common/PlainText';
import SlipDialog from '../../common/slip/SlipDialog';
import SlipField from '../../common/slip/SlipField';
import Stamp from '../../common/Stamp';
import { ASK_AGAIN_LINE, CHOICE_LABEL, KEY_CANCEL, STATE_WORD, stateLine } from '../copy';
import AppIcon from '../icon/AppIcon';
import { type AppTarget, choicesFor } from '../logic/choices';

type Props = {
  /** The app whose row was tapped; null: closed. */
  app: AppAccessApp | null;
  onPick: (to: AppTarget) => void;
  onClose: () => void;
};

// One answered app's pop-up, from the Apps page: the app as on its slip
// (its icon and package in the dashed box, its name set into the edge),
// its state stamped beside what that means, and the changes it can take (a
// blocked app can be always allowed, an always one blocked, either asked
// again).
export default function AppChoiceDialog({ app, onPick, onClose }: Props) {
  const choices = app ? choicesFor(app.state) : [];
  const blocked = app?.state === 'blocked';
  return (
    <SlipDialog open={app !== null} onClose={onClose} scrimCloses>
      {app ? (
        <SlipField label={app.label} value={app.package} lines={2} leading={<AppIcon pkg={app.package} size={40} dim={blocked} />} />
      ) : null}
      {app ? (
        <XStack alignItems="center" gap="3">
          <YStack>
            <Stamp tone={blocked ? 'primary' : 'secondary'}>{STATE_WORD[app.state]}</Stamp>
          </YStack>
          <PlainText fontSize={15} flex={1} minWidth={0}>
            {stateLine(app.state)}
          </PlainText>
        </XStack>
      ) : null}
      <PlainText fontSize={13} color="muted">
        {ASK_AGAIN_LINE}
      </PlainText>
      <DeckKeys
        actions={[
          ...choices.map((to) => ({
            label: CHOICE_LABEL[to],
            role: to === 'always' ? ('go' as const) : ('more' as const),
            mark: to === 'always' ? ('save' as const) : undefined,
            onPress: () => onPick(to),
          })),
          { label: KEY_CANCEL, role: 'back', onPress: onClose },
        ]}
      />
    </SlipDialog>
  );
}
