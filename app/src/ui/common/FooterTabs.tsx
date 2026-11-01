import { Button, XStack } from 'tamagui';
import { useAppStore, type FooterTab } from '../../state/app';
import { webGoHome } from '../chat/webNavigation';
import { HIT, useTheme } from './globals';

const TABS: { id: FooterTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'env', label: 'Env' },
  { id: 'settings', label: 'Settings' },
];

// Thin mono tab strip: the site's nav links, not three filled buttons. The
// active tab is marked by colour + a 2px red underline (not colour alone);
// 56dp still clears the 48dp touch minimum.
export default function FooterTabs() {
  const t = useTheme();
  const footerTab = useAppStore((s) => s.footerTab);
  const setFooterTab = useAppStore((s) => s.setFooterTab);
  const goHome = useAppStore((s) => s.goHome);

  function press(tab: FooterTab) {
    if (tab === 'home') {
      // Already on the web tab: Home again returns to opencode's project list.
      if (footerTab === 'home') webGoHome();
      else goHome();
    } else {
      setFooterTab(tab);
    }
  }

  function active(tab: FooterTab) {
    return footerTab === tab;
  }

  return (
    <XStack
      borderTopWidth={1}
      borderColor={t.line}
      backgroundColor={t.panel}
      minHeight={HIT.tabH}
      alignItems="stretch"
    >
      {TABS.map((tab) => {
        const isActive = active(tab.id);
        return (
          <Button
            key={tab.id}
            flex={1}
            minHeight={HIT.tabH}
            borderRadius={0}
            borderWidth={0}
            borderBottomWidth={2}
            borderBottomColor={isActive ? t.primary : 'transparent'}
            backgroundColor="transparent"
            color={isActive ? t.fg : t.dim}
            fontSize={12}
            fontWeight={isActive ? '600' : '500'}
            letterSpacing={1.4}
            textProps={{ textTransform: 'uppercase' }}
            onPress={() => press(tab.id)}
            accessibilityState={{ selected: isActive }}
          >
            {tab.label}
          </Button>
        );
      })}
    </XStack>
  );
}
