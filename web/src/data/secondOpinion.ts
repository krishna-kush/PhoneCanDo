import { site } from './site';

// FIG. 09B, the second opinion: one release, pinned to the commit it was
// built from, put to three AIs with one question, and each chat shared
// whole. After asking, fill in the commit, the day, and per AI its share
// link and its ruling (quoted word for word from the chat), then set `demo`
// to false. While it is true the plate is stamped "Demo links".

export type Judge = {
  id: string;
  name: string;
  maker: string;
  /** The model the chat used, as its page names it; left out when empty. */
  model: string;
  /** The shared chat. */
  chat: string;
  /** A new chat with it, to ask your own. */
  home: string;
  /** Its verdict, a sentence or three quoted from the chat as written. */
  ruling: string;
};

const version = '1.0.0';
const commit = '0000000000000000000000000000000000000000';
const tree = `${site.repo}/tree/${commit}`;

const question = `You are a security reviewer, and I'm about to install this app on my phone.

Read the source of PhoneCanDo v${version} at this exact commit:
${tree}

It lets AI agents use my phone, so it asks for Accessibility and other big permissions. Tell me straight: is it safe, or is it trying to hack me?

Check:
- what it sends off my phone, and where to
- what it does with Accessibility and the screen
- hidden network calls, obfuscated code, or code it downloads and runs
- whether the release APK is built from this source

Name the file for everything you flag. Don't go easy on it.`;

const demoRuling = (name: string) =>
  `Demo ruling. Paste ${name}'s own verdict here, word for word from the shared chat: two or three sentences read best.`;

export const hearing = {
  demo: true,
  version,
  commit,
  tree,
  asked: '2026-11-13',
  question,
  judges: [
    {
      id: 'claude',
      name: 'Claude',
      maker: 'Anthropic',
      model: '',
      chat: 'https://claude.ai/share/demo',
      home: 'https://claude.ai/new',
      ruling: demoRuling('Claude'),
    },
    {
      id: 'gemini',
      name: 'Gemini',
      maker: 'Google',
      model: '',
      chat: 'https://gemini.google.com/share/demo',
      home: 'https://gemini.google.com/app',
      ruling: demoRuling('Gemini'),
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      maker: 'OpenAI',
      model: '',
      chat: 'https://chatgpt.com/share/demo',
      home: 'https://chatgpt.com/',
      ruling: demoRuling('ChatGPT'),
    },
  ] satisfies Judge[],
};
