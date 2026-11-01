import { useState } from 'react';
import { Button, Sheet, Text, XStack } from 'tamagui';
import { useAppStore } from '../../state/app';
import { webGoBack, webGoHome } from '../chat/webNavigation';
import BackIcon from './BackIcon';
import AppButton from './AppButton';
import CardMenu, { type CardMenuItem } from './CardMenu';
import LicensesDialog from './LicensesDialog';
import LogoMark from './LogoMark';
import { HIT, useTheme } from './globals';

// 60dp app bar with one shared row layout: left side always
// `flex={1} minWidth={0}` so long titles truncate instead of pushing the ⋮
// menu off-screen. Home IS the web UI (no app-side projects/chats anymore):
// the ⋮ menu opens the terminal (via the folder picker), Settings, About.
export default function AppHeader() {
  const t = useTheme();
  const terminalDir = useAppStore((s) => s.terminalDir);
  const closeTerminal = useAppStore((s) => s.closeTerminal);
  const setFolderPickerOpen = useAppStore((s) => s.setFolderPickerOpen);
  const footerTab = useAppStore((s) => s.footerTab);
  const setFooterTab = useAppStore((s) => s.setFooterTab);
  const webCanGoBack = useAppStore((s) => s.webCanGoBack);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);

  const title = terminalDir
    ? (terminalDir.split('/').filter(Boolean).pop() ?? 'Terminal')
    : 'PhoneCanDo';

  const menuItems: CardMenuItem[] = terminalDir
    ? [
        { label: 'Back to web UI', onSelect: () => closeTerminal() },
        { label: 'Settings', onSelect: () => setFooterTab('settings') },
        { label: 'About', onSelect: () => setAboutOpen(true) },
      ]
    : [
        {
          label: 'OpenCode home',
          onSelect: () => {
            setFooterTab('home');
            webGoHome();
          },
        },
        { label: 'Open terminal UI', onSelect: () => setFolderPickerOpen(true) },
        { label: 'Settings', onSelect: () => setFooterTab('settings') },
        { label: 'About', onSelect: () => setAboutOpen(true) },
      ];

  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$2"
      minHeight={HIT.headerH}
      borderBottomWidth={1}
      borderColor={t.line}
      backgroundColor={t.panel}
    >
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        {terminalDir ? (
          <>
            <HeaderButton a11y="Back to web UI" onPress={closeTerminal} />
            <HeaderTitle text={title} />
          </>
        ) : (
          <>
            {footerTab === 'home' && webCanGoBack ? (
              <HeaderButton a11y="Back in web UI" onPress={() => webGoBack()} />
            ) : null}
            <XStack alignItems="center" gap={6} flex={1} minWidth={0}>
              <LogoMark size={13} />
              <HeaderTitle text={title} />
            </XStack>
          </>
        )}
      </XStack>

      <CardMenu items={menuItems} label="Menu" offset={-24} />

      <Sheet
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        modal
        dismissOnSnapToBottom
        snapPointsMode="fit"
      >
        <Sheet.Frame
          padding="$4"
          paddingBottom="$6"
          gap="$3"
          borderRadius={0}
          borderWidth={1}
          borderColor={t.lineStrong}
        >
          <XStack alignItems="center" gap={6}>
            <LogoMark size={14} />
            <Text fontFamily="$mono" fontWeight="600" fontSize={17} letterSpacing={-0.3}>
              PhoneCanDo
            </Text>
          </XStack>
          <Text fontSize={15} color="$color10">
            On-device opencode chat for Android. Home is the web UI; the terminal tab
            attaches a TUI to any folder in the container.
          </Text>
          <AppButton
            variant="secondary"
            onPress={() => {
              setAboutOpen(false);
              setLicensesOpen(true);
            }}
          >
            Licenses
          </AppButton>
        </Sheet.Frame>
        <Sheet.Overlay />
      </Sheet>

      <LicensesDialog open={licensesOpen} onClose={() => setLicensesOpen(false)} />
    </XStack>
  );
}

function HeaderButton({ a11y, onPress }: { a11y: string; onPress: () => void }) {
  return (
    <Button
      width={HIT.minTouch}
      height={HIT.minTouch}
      borderRadius={0}
      chromeless
      flexShrink={0}
      paddingHorizontal={0}
      justifyContent="center"
      alignItems="center"
      onPress={onPress}
      accessibilityLabel={a11y}
    >
      <BackIcon size={22} />
    </Button>
  );
}

// Mono brand title next to the logo mark. The terminal view swaps the brand
// for the folder name, so the mark only shows on the app title.
function HeaderTitle({ text }: { text: string }) {
  return (
    <Text
      fontFamily="$mono"
      fontSize={17}
      fontWeight="600"
      letterSpacing={-0.3}
      numberOfLines={1}
      ellipsizeMode="tail"
      flexShrink={1}
      minWidth={0}
    >
      {text}
    </Text>
  );
}
