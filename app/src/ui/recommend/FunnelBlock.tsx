import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import { ROW_GUTTER } from '../common/rows/place';
import Stamp from '../common/Stamp';
import { useReduceMotion } from '../common/useReduceMotion';
import { FUNNEL_TITLE } from './copy';
import type { Funnel, FunnelStep } from './logic/funnel';
import { crewStamp, reach, routeVerdict } from './logic/route';
import RouteStop from './RouteStop';

// How long each stop waits after the one above before it lights.
const STEP_MS = 140;

// What every link did, as a route in one key box: a line that says it the
// way a friend would (and a +1 crew stamp slammed on once a link brought
// someone in), then the stops Sent → Opened → Downloaded → Installed →
// Using it, each with its count, on a rail. The stops a friend reached
// light one after another as the page comes in, so the red runs down the
// route as far as the links got.
export default function FunnelBlock({ funnel, steps }: { funnel: Funnel; steps: FunnelStep[] }) {
  const furthest = reach(funnel);
  const lit = useLighting(furthest);
  const stamp = crewStamp(funnel);
  return (
    <RowGroup title={FUNNEL_TITLE} barcode="shareFunnel">
      <RowFrame>
        <XStack alignItems="center" gap="3">
          <PlainText fontSize={15} flex={1}>
            {routeVerdict(funnel)}
          </PlainText>
          {stamp ? (
            <Stamp key={stamp} slam>
              {stamp}
            </Stamp>
          ) : null}
        </XStack>
      </RowFrame>
      <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="2">
        {steps.map((s, i) => (
          <XStack key={s.key} gap="3" accessible accessibilityLabel={`${s.label}: ${s.count}, ${s.line}`}>
            <RouteStop lit={i < lit} above={i === 0 ? null : i < lit} below={i === steps.length - 1 ? null : i + 1 < lit} />
            <XStack flex={1} minWidth={0} alignItems="center" gap="3" paddingVertical="2">
              <YStack flex={1} minWidth={0} gap={2}>
                <PlainText fontFamily="mono" fontSize={11} fontWeight="600" letterSpacing={1.4} color={i <= furthest ? 'fg' : 'dim'} textTransform="uppercase">
                  {s.label}
                </PlainText>
                <PlainText fontSize={13} color="muted" numberOfLines={1}>
                  {s.line}
                </PlainText>
              </YStack>
              <PlainText fontFamily="mono" fontSize={22} fontWeight="700" color={s.count > 0 ? 'fg' : 'faint'}>
                {String(s.count)}
              </PlainText>
            </XStack>
          </XStack>
        ))}
      </YStack>
    </RowGroup>
  );
}

// How many stops are lit now: from none, one more every STEP_MS up to the
// furthest reached; at once with reduce motion. A route that got shorter
// (the list changed) drops back at once.
function useLighting(furthest: number): number {
  const reduce = useReduceMotion();
  const target = furthest + 1;
  const [lit, setLit] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce || lit >= target) {
      if (lit !== target && (reduce || lit > target)) setLit(target);
      return;
    }
    const timer = setTimeout(() => setLit((n) => n + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [lit, target, reduce]);
  return lit;
}
