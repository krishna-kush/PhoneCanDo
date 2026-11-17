import { YStack } from 'tamagui';
import { noOfferText } from '../logic/agentChoice';
import Note from '../parts/Note';
import ArcadePicker from './picker/arcade/ArcadePicker';
import type { PickerProps } from './picker/props';

// The kinds a creation step offers, in offers.ts order, one picked, as an
// arcade's character select (picker/arcade/), each standing as an applicant
// in its own mascot (picker/useApplicantLooks.ts). First launch shows it
// too.
export default function AgentPicker(props: PickerProps) {
  const none = noOfferText(props.offers);
  return (
    <YStack gap="3">
      <ArcadePicker {...props} />
      {none ? <Note tone="error">{none}</Note> : null}
    </YStack>
  );
}
