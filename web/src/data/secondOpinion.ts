import { site } from './site';
import pin from './secondOpinion.json';

// FIG. 09B, the second opinion: one release, pinned to the commit it was
// built from, put to three AIs with one question, and each chat shared
// whole. We don't ask again every release: the page says how far the site's
// release has moved on and links the changes, and `./manage release` reminds
// us when code a reviewer cares about has changed since the pin
// (scripts/release/hearing/). To ask again, edit only secondOpinion.json:
// the version, its commit, the day, and per AI its share link, the model its
// page names and its ruling (quoted word for word from the chat), then set
// `demo` to false. While it is true the plate is stamped "Demo links".

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

type Bench = Pick<Judge, 'id' | 'name' | 'maker' | 'home'>;

const BENCHES: Bench[] = [
  { id: 'claude', name: 'Claude', maker: 'Anthropic', home: 'https://claude.ai/new' },
  { id: 'gemini', name: 'Gemini', maker: 'Google', home: 'https://gemini.google.com/app' },
  { id: 'chatgpt', name: 'ChatGPT', maker: 'OpenAI', home: 'https://chatgpt.com/' },
];

const askAbout = (version: string, tree: string) => `You are a security reviewer, and I'm about to install this app on my phone.

Read the source of PhoneCanDo v${version} at this exact commit:
${tree}

It lets AI agents use my phone, so it asks for Accessibility and other big permissions. Tell me straight: is it safe, or is it trying to hack me?

Check:
- what it sends off my phone, and where to
- what it does with Accessibility and the screen
- hidden network calls, obfuscated code, or code it downloads and runs
- whether the release APK is built from this source. The GitHub workflow
  .github/workflows/release.yml builds and signs it, and GitHub attests each
  APK (${site.repo}/attestations). Check the workflow, and say what the
  attestation does and doesn't prove.

Name the file for everything you flag. Don't go easy on it.`;

const demoRuling = (name: string) =>
  `Demo ruling. Paste ${name}'s own verdict here, word for word from the shared chat: two or three sentences read best.`;

const judgesPinned: Record<string, { model: string; chat: string; ruling: string }> = pin.judges;

const tree = `${site.repo}/tree/${pin.commit}`;
/** The release the site offers now, when it is newer than the one on trial. */
const latest = pin.version === site.version ? null : {
  version: site.version,
  /** The question as the judges got it, pointed at this release's code instead. */
  question: askAbout(site.version, `${site.repo}/tree/v${site.version}`),
  /** Everything that changed since the commit on trial. */
  changes: `${site.repo}/compare/${pin.commit}...v${site.version}`,
};

export const hearing = {
  demo: pin.demo,
  version: pin.version,
  commit: pin.commit,
  tree,
  asked: pin.asked,
  question: askAbout(pin.version, tree),
  latest,
  judges: BENCHES.map((bench) => {
    const heard = judgesPinned[bench.id];
    if (!heard) throw new Error(`web/src/data/secondOpinion.json has no judge "${bench.id}"`);
    // Out of demo, every judge needs its real chat and its own words.
    if (!pin.demo && (!heard.ruling || heard.chat.endsWith('/demo'))) {
      throw new Error(`web/src/data/secondOpinion.json: "${bench.id}" still has a demo chat or no ruling`);
    }
    return { ...bench, ...heard, ruling: heard.ruling || demoRuling(bench.name) };
  }) satisfies Judge[],
};
