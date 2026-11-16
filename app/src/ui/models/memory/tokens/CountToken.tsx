import { YStack } from 'tamagui';
import Lift from '../../../common/bench/Lift';
import type { CountKind } from '../../logic/memory';
import Bubble from './Bubble';
import Core from './Core';
import type { TokenState } from './ink';
import Snapshot from './Snapshot';

// What sits on a place of a count's bench: a chat bubble, a snapshot or a
// core. In the count it drops into its place; out of it it lifts out,
// faded.
export default function CountToken({ kind, state }: { kind: CountKind; state: TokenState }) {
  const Token = kind === 'saved' ? Bubble : kind === 'snapshots' ? Snapshot : Core;
  return (
    <Lift up={state === 'out'}>
      <YStack opacity={state === 'out' ? 0.6 : 1}>
        <Token state={state} />
      </YStack>
    </Lift>
  );
}
