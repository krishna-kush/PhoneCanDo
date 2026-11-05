import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import ThumbIcon from '../common/ThumbIcon';
import { COPY } from './guide';
import StepLinks from './StepLinks';
import StepList from './StepList';
import type { AccessibilitySteps } from './useAccessibilitySteps';

// Settings → Phone control: the Accessibility card and, while the switch is
// locked, the three-step guide. The parent owns the hook so it can trim its
// own text once the switch is on.
export default function AccessibilitySetup({ a11y }: { a11y: AccessibilitySteps }) {
  const title = a11y.connected
    ? 'Accessibility service: on'
    : a11y.enabled
      ? 'Accessibility service: switched on, starting'
      : a11y.guided
        ? `Accessibility service: off · step ${a11y.step} of ${a11y.total}`
        : 'Accessibility service: off';
  const subtitle = a11y.enabled ? COPY.onHint : a11y.guided ? COPY.restrictedNote : COPY.plainHint;
  return (
    <>
      <AppCard
        title={title}
        subtitle={subtitle}
        chevron={false}
        icon={<ThumbIcon up={a11y.connected} size={26} />}
      />
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
          <StepLinks
            links={a11y.canForce ? [{ label: COPY.forceGuide, onPress: a11y.forceGuide }] : []}
          />
        </>
      )}
    </>
  );
}
