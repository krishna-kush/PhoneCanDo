import { XStack, YStack } from 'tamagui';
import type { AppAccessApp } from '../../../engine/appAccess';
import PlainText from '../../common/PlainText';
import OpenRow from '../../common/rows/OpenRow';
import { appSaid, CHANGE_A11Y } from '../copy';
import AppIcon from '../icon/AppIcon';

type Props = {
  app: AppAccessApp;
  onOpen: (app: AppAccessApp) => void;
};

// One answered app: its own icon, its name and package, and the ›
// that opens its pop-up. A blocked one's icon is faded, as its box says.
export default function GuestRow({ app, onOpen }: Props) {
  return (
    <OpenRow label={appSaid(app.label, app.state)} hint={CHANGE_A11Y} onPress={() => onOpen(app)}>
      <XStack alignItems="center" gap="3">
        <AppIcon pkg={app.package} size={34} dim={app.state === 'blocked'} />
        <YStack flex={1} minWidth={0} gap={2}>
          <PlainText fontSize={16} fontWeight="500" numberOfLines={1}>
            {app.label}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
            {app.package}
          </PlainText>
        </YStack>
      </XStack>
    </OpenRow>
  );
}
