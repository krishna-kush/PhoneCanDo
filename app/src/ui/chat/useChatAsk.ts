import { useCallback, useEffect, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { onChatAsk, takeChat } from './chatAsk';
import { lastPage } from './lastPage';
import { chatUrl } from './logic/chatPath';

// Takes the chat Home was asked to open (chatAsk.ts) into an agent's web
// view. One that shows a page ([shown]) goes there at once, the way Home's
// menu goes home. One still pairing or loading keeps the ask until a page
// finishes: AgentWebView's onLoadEnd calls the returned landing, which
// wins over the restore of the last page. A web UI whose chats have no URL
// (no [sessionUrl]) is never asked (openChat); one with no [sessionPath]
// goes only where its own pages show the way.
export function useChatAsk(
  agentId: string,
  sessionUrl: string | null,
  sessionPath: string | null,
  web: RefObject<WebView<object> | null>,
  currentUrl: RefObject<string>,
  shown: RefObject<boolean>,
): (loadedUrl: string) => string | null {
  const landing = useCallback(
    (loadedUrl: string) => {
      const chatId = takeChat(agentId);
      return sessionUrl && chatId ? chatUrl(sessionUrl, sessionPath, loadedUrl, chatId, [lastPage(agentId)]) : null;
    },
    [agentId, sessionUrl, sessionPath],
  );

  useEffect(
    () =>
      onChatAsk(agentId, () => {
        if (!shown.current || !web.current) return;
        const target = landing(currentUrl.current);
        if (target) web.current.injectJavaScript(`window.location.href = ${JSON.stringify(target)}; true;`);
      }),
    [agentId, landing, web, currentUrl, shown],
  );

  return landing;
}
