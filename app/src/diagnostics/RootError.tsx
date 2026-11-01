import { Component, type ReactNode } from 'react';
import { Text, YStack } from 'tamagui';

type Props = { children: ReactNode };
type State = { error: string | null };

export default class RootError extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: unknown): State {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.log('[PHONECANDO-DBG] root error boundary:', e instanceof Error ? e.stack : e);
  }

  render() {
    if (this.state.error) {
      return (
        <YStack flex={1} backgroundColor="#300" padding="$3" gap="$2">
          <Text color="#fff" fontWeight="bold">
            Render crashed:
          </Text>
          <Text color="#fff">{this.state.error}</Text>
        </YStack>
      );
    }
    return this.props.children;
  }
}
