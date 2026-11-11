import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTheme } from '../common/globals';
import PageLayer from './PageLayer';
import { usePageTransitions } from './usePageTransitions';

// Home with the stack of pages over it (state/app/navigation.ts), each page
// on a layer of its own that moves as Android's pages do (motion.ts). A
// change of the stack renders this list once; a layer already drawn does
// not render again (PageLayer is memoised on props it keeps for life).
export default function PageStack({ home }: { home: ReactNode }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const layers = usePageTransitions();

  return (
    <View style={{ flex: 1, backgroundColor: t.panel }}>
      {layers.map((layer) => (
        <PageLayer key={layer.key} layerKey={layer.key} page={layer.page} home={layer.page ? null : home} width={width} />
      ))}
    </View>
  );
}
