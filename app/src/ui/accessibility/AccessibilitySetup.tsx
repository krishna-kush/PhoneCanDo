import { XStack, YStack } from 'tamagui';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import LiveLight from '../common/rows/LiveLight';
import RowFrame from '../common/rows/RowFrame';
import { usePageActive } from '../nav/pageActive';
import { COPY } from './guide';
import StepLinks from './StepLinks';
import StepList from './StepList';
import type { AccessibilitySteps } from './useAccessibilitySteps';

// Settings → Phone control: the Accessibility row of the panel's key box
// and, while the switch is locked, the three-step guide inside it. A live
// light beside its state while the service runs. The parent owns the hook
// so it can trim its own text once the switch is on. It sits at the top of
// Settings, so all of it mounts with the page.
export default function AccessibilitySetup({ a11y }: { a11y: AccessibilitySteps }) {
  const active = usePageActive();
  const title = a11y.connected
    ? 'Accessibility service: on'
    : a11y.enabled
      ? 'Accessibility service: switched on, starting'
      : a11y.guided
        ? `Accessibility service: off · step ${a11y.step} of ${a11y.total}`
        : 'Accessibility service: off';
  const subtitle = a11y.enabled ? COPY.onHint : a11y.guided ? COPY.restrictedNote : COPY.plainHint;
  return (
    <RowFrame>
      <YStack gap="3">
        <YStack gap={2}>
          <XStack alignItems="center" gap="2">
            {a11y.connected ? <LiveLight still={!active} /> : null}
            <PlainText fontSize={16} fontWeight="600" flexShrink={1}>
              {title}
            </PlainText>
          </XStack>
          <PlainText fontSize={13} color="muted">
            {subtitle}
          </PlainText>
        </YStack>
        {a11y.guided ? (
          <>
            <StepList step={a11y.step} note={a11y.note} />
            <AppButton onPress={() => a11y.open()}>{a11y.copy.button}</AppButton>
            <StepLinks
              links={[
                ...(a11y.alt ? [{ label: a11y.alt.label, onPress: a11y.alt.run }] : []),
                ...a11y.fixes.map((fix) => ({ label: fix.label, onPress: () => a11y.goTo(fix.to) })),
              ]}
            />
          </>
        ) : (
          <>
            <AppButton variant="secondary" onPress={() => a11y.open()}>
              Open accessibility settings
            </AppButton>
            <StepLinks links={a11y.canForce ? [{ label: COPY.forceGuide, onPress: a11y.forceGuide }] : []} />
          </>
        )}
      </YStack>
    </RowFrame>
  );
}
