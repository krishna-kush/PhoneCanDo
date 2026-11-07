import type { ReinstallList } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import { forgetReinstall } from '../../../state/flows/resetAgentImage';
import AppButton from '../../common/AppButton';
import { reinstallLine } from '../logic/hints';
import Note from '../parts/Note';

type Props = { agentId: string; imageId: string; offer: ReinstallList; onDone: () => void };

// After a reset: what it removed, and a terminal with the one line that
// installs it all again, typed in but not run. Either button ends the offer.
export default function ReinstallOffer({ agentId, imageId, offer, onDone }: Props) {
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);

  const finish = () => {
    forgetReinstall(imageId);
    onDone();
  };

  return (
    <>
      <Note>{reinstallLine(offer.packages)}</Note>
      <AppButton
        variant="secondary"
        onPress={() => {
          finish();
          openLinuxTerminal(agentId, offer.installCommand);
        }}
      >
        Open terminal with the install command
      </AppButton>
      <AppButton variant="ghost" onPress={finish}>
        Dismiss
      </AppButton>
    </>
  );
}
