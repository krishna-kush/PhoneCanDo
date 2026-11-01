import { View } from 'react-native';
import logo from '../../../../theme/logo.json';
import { useTheme } from './globals';

// The official mark: a red square with a hard amber shadow at the right and
// bottom. Geometry comes from theme/logo.json, shared with the web.
export function logoOffset(size: number): number {
  return Math.max(logo.shadow.minUiPx, Math.round(size * logo.shadow.ratio));
}

export default function LogoMark({ size = 13 }: { size?: number }) {
  const t = useTheme();
  const off = logoOffset(size);
  return (
    <View
      style={{ width: size + off, height: size + off, flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          position: 'absolute',
          left: off,
          top: off,
          width: size,
          height: size,
          backgroundColor: t.secondary,
        }}
      />
      <View style={{ width: size, height: size, backgroundColor: t.primary }} />
    </View>
  );
}
