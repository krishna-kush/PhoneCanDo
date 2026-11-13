import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { openAlarmSettings } from '../../engine/schedule/native';
import PlainText from '../common/PlainText';
import TextAction from '../drawer/select/TextAction';
import { ALARMS_FAILED, ALLOW_ALARMS, LATE_LINE, LATE_NOTE } from './logic/scheduleCopy';

// While Android's exact alarms are off for us (Alarms & reminders), runs
// may come late: one line saying so and Allow alarms, which opens that
// Android page. Coming back to the app re-reads it (state/schedule.ts),
// so the row goes once it is allowed.
export default function LateRunsRow() {
  const [failed, setFailed] = useState(false);
  return (
    <YStack borderWidth={1} borderColor="secondaryLine" backgroundColor="secondarySoft" padding="3" gap="2">
      <XStack alignItems="center" gap="3">
        <PlainText fontSize={15} fontWeight="600" color="secondaryInk" flex={1}>
          {LATE_LINE}
        </PlainText>
        <TextAction label={ALLOW_ALARMS} onPress={() => setFailed(!openAlarmSettings())} />
      </XStack>
      <PlainText fontSize={13} color={failed ? 'primary' : 'muted'}>
        {failed ? ALARMS_FAILED : LATE_NOTE}
      </PlainText>
    </YStack>
  );
}
