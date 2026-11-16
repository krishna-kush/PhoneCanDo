import { XStack, YStack } from 'tamagui';
import type { KindReview } from '../../../engine/agents/user/review';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { acpReviewLine, familyName, PHONE_TOOLS_OFF, runtimeName } from '../logic/customAgentText';
import Note from '../parts/Note';

// What a custom agent runs, before it is saved or imported, as the site's
// key boxes: the command that starts it, everything its install does in
// the machine, its update, its version check, whether it gets the phone
// tools and its ACP mode. A command wears the terminal's amber "$".
export default function KindReviewView({ review }: { review: KindReview }) {
  const installs = review.runtimes.length > 0 || review.packages.length > 0 || review.installSteps.length > 0;
  return (
    <>
      <RowGroup title="Starts with" barcode="reviewStarts">
        <RowFrame>
          <Code text={review.command} prompt />
        </RowFrame>
        {review.env.length > 0 ? (
          <RowFrame>
            <Code text={review.env.join('\n')} />
          </RowFrame>
        ) : null}
      </RowGroup>

      <RowGroup title="Install · as root, with network" barcode="reviewInstall">
        {!installs ? (
          <RowFrame>
            <Note>Nothing is installed: its command must already be in the machine.</Note>
          </RowFrame>
        ) : null}
        {review.runtimes.map((need) => (
          <RowFrame key={need}>
            <Note>{`${runtimeName(need)}, first.`}</Note>
          </RowFrame>
        ))}
        {review.packages.map((p) => (
          <RowFrame key={p.family}>
            <Note>{`Packages, ${familyName(p.family)}: ${p.names.join(' ')}`}</Note>
          </RowFrame>
        ))}
        {review.installSteps.map((step, i) => (
          <Step key={`${i}:${step}`} n={i + 1} text={step} />
        ))}
      </RowGroup>

      {review.updateSteps ? (
        <RowGroup title="Update" barcode="reviewUpdate">
          {review.updateSteps.map((step, i) => (
            <Step key={`${i}:${step}`} n={i + 1} text={step} />
          ))}
        </RowGroup>
      ) : review.installSteps.length > 0 ? (
        <Note>Update agent runs the install steps again.</Note>
      ) : null}

      {review.versionCommand ? (
        <RowGroup title="Version" barcode="reviewVersion">
          <RowFrame>
            <Code text={review.versionCommand} prompt />
          </RowFrame>
        </RowGroup>
      ) : null}

      <RowGroup title="Phone tools" barcode="reviewPhoneTools">
        <RowFrame>
          <Note>{review.phoneTools ? 'On: it gets the bridge and its token, and can use the phone tools.' : PHONE_TOOLS_OFF}</Note>
        </RowFrame>
      </RowGroup>

      <RowGroup title="ACP mode" barcode="reviewAcp">
        {review.acpCommand ? (
          <RowFrame>
            <Code text={review.acpCommand} prompt />
          </RowFrame>
        ) : null}
        <RowFrame>
          <Note>{acpReviewLine(review.acpCommand)}</Note>
        </RowFrame>
      </RowGroup>
    </>
  );
}

// One install or update step: its number, then its shell text.
function Step({ n, text }: { n: number; text: string }) {
  return (
    <RowFrame>
      <YStack gap="1">
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint">
          {`Step ${String(n).padStart(2, '0')}`}
        </PlainText>
        <Code text={text} />
      </YStack>
    </RowFrame>
  );
}

// Shell text as it is, monospaced and selectable, sunk into the page's
// ground; a command (`prompt`) after an amber "$".
function Code({ text, prompt = false }: { text: string; prompt?: boolean }) {
  return (
    <XStack gap="2" backgroundColor="bg" paddingHorizontal="2" paddingVertical="2">
      {prompt ? (
        <PlainText fontFamily="mono" fontSize={12} lineHeight="17px" color="secondaryInk">
          $
        </PlainText>
      ) : null}
      <PlainText fontFamily="mono" fontSize={12} lineHeight="17px" color="fg" userSelect="text" flex={1}>
        {text}
      </PlainText>
    </XStack>
  );
}
