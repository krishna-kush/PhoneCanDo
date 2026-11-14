// Each agent card's flavor line (components/sections/models/AgentCard.astro):
// one fond joke per kind, about as long and as funny as the others, with a
// punchline each. The facts live elsewhere on the card (where it lives, how
// it signs in, its brain); this is the line that makes it a trading card.
// Keyed by the kind's id; a kind without one fails the build, so a new kind
// gets its joke too.
export const QUIPS: Record<string, string> = {
  opencode: 'Came in the box, no machine needed. First to arrive, last to leave.',
  aider: 'Commits every change as it goes. Your git log has never been busier.',
  'claude-code': 'Writes itself a to-do list, then ticks every box. A little smug about it.',
  cline: 'Plans, then acts, and checks with you in between. Every. Single. Step.',
  codex: 'Codes inside a sandbox and asks before it steps out. Wipes its feet, too.',
  crush: 'The best-dressed terminal on the phone. Also, somehow, writes code.',
  'cursor-cli': 'Left the editor at home. Packed every trick it learned there.',
  'gemini-cli': 'Reads a million tokens before breakfast. Still asks for seconds.',
  'copilot-cli': 'On first-name terms with your pull requests. Your issues too.',
  goose: 'Takes any extension you hand it. Absolutely, definitely not a duck.',
  'kimi-code': 'Built by Moonshot, so it aims high. Lands right in your repo.',
  'mistral-vibe': 'Vibe coding with a French accent. Every fix ends in voilà.',
  pi: 'Tiny name, tiny prompt, no fuss. Gets an irrational amount done.',
  'qwen-code': 'Happy to run on a Qwen right in your phone. Keeps it in the family.',
};

/** A kind's flavor line; throws for a kind that has none yet. */
export function quipOf(id: string): string {
  const quip = QUIPS[id];
  if (!quip) throw new Error(`data/cardQuips.ts has no flavor line for the agent kind "${id}": give its card one.`);
  return quip;
}
