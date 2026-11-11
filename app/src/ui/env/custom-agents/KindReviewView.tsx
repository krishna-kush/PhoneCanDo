import { Text, YStack } from 'tamagui';
import type { KindReview } from '../../../engine/agents/user/review';
import SectionTitle from '../../common/SectionTitle';
import { useTheme } from '../../common/globals';
import { familyName, PHONE_TOOLS_OFF, runtimeName } from '../logic/customAgentText';
import Note from '../parts/Note';

// What a custom agent runs, before it is saved or imported: the command
// that starts it, everything its install does in the machine, its update,
// its version check and whether it gets the phone tools.
export default function KindReviewView({ review }: { review: KindReview }) {
  const installs = review.runtimes.length > 0 || review.packages.length > 0 || review.installSteps.length > 0;
  return (
    <>
      <SectionTitle>Starts with</SectionTitle>
      <Code text={review.command} />
      {review.env.length > 0 ? <Code text={review.env.join('\n')} /> : null}

      <SectionTitle>Install, as root, with network</SectionTitle>
      {!installs ? <Note>Nothing is installed: its command must already be in the machine.</Note> : null}
      {review.runtimes.map((need) => (
        <Note key={need}>{`${runtimeName(need)}, first.`}</Note>
      ))}
      {review.packages.map((p) => (
        <Note key={p.family}>{`Packages, ${familyName(p.family)}: ${p.names.join(' ')}`}</Note>
      ))}
      {review.installSteps.map((step, i) => (
        <YStack key={`${i}:${step}`} gap="1">
          <Note>{`Step ${i + 1}`}</Note>
          <Code text={step} />
        </YStack>
      ))}

      {review.updateSteps ? (
        <>
          <SectionTitle>Update</SectionTitle>
          {review.updateSteps.map((step, i) => (
            <YStack key={`${i}:${step}`} gap="1">
              <Note>{`Step ${i + 1}`}</Note>
              <Code text={step} />
            </YStack>
          ))}
        </>
      ) : review.installSteps.length > 0 ? (
        <Note>Update agent runs the install steps again.</Note>
      ) : null}

      {review.versionCommand ? (
        <>
          <SectionTitle>Version</SectionTitle>
          <Code text={review.versionCommand} />
        </>
      ) : null}

      <SectionTitle>Phone tools</SectionTitle>
      <Note>{review.phoneTools ? 'On: it gets the bridge and its token, and can use the phone tools.' : PHONE_TOOLS_OFF}</Note>
    </>
  );
}

// Shell text as it is, monospaced and selectable, in a hairline box.
function Code({ text }: { text: string }) {
  const t = useTheme();
  return (
    <YStack borderWidth={1} borderColor={t.line} backgroundColor={t.panel} padding="3">
      <Text fontFamily="mono" fontSize={12} lineHeight="17px" color={t.fg} userSelect="text">
        {text}
      </Text>
    </YStack>
  );
}
