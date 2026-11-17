import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { SpotId } from './ids';
import type { SpotReach } from './registry';
import { useSpot } from './useSpot';

type Props = {
  /** Its name; null: no mark, the children as they are. */
  id: SpotId | null;
  /**
   * The press reach of what it wraps (LinkRow's `reach`): the box reaches as
   * far, so a tap there still lands, and a guide frames what shows.
   */
  reach?: SpotReach;
  /** Takes the room its slot gives (Home's chat). */
  fill?: boolean;
  children: ReactNode;
};

// Marks what it wraps as a spot a guide can point at (ids.ts): a plain box
// around it, laid out as the thing itself would be.
export default function Spot({ id, reach, fill = false, children }: Props) {
  const ref = useSpot(id, reach);
  if (!id) return <>{children}</>;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        fill && { flex: 1 },
        reach && {
          marginHorizontal: -reach.x,
          marginVertical: -reach.y,
          paddingHorizontal: reach.x,
          paddingVertical: reach.y,
        },
      ]}
    >
      {children}
    </View>
  );
}
