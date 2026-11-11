// What a terminal session runs, built when it opens: the agent kind's
// terminal UI attached to that agent's engine, or a shell in the agent's
// Linux image. Both go through the same generic PTY (engine/terminal.ts),
// so the IME and sizing path is the same. Either starts knowing the app's
// scheme (COLORFGBG) and keeps that value; queries follow a change live
// (theme/).
import type { Agent } from '../../engine/agents/records';
import type { PtyRecipe } from '../../../../agents/kit/ts/contract/pty.ts';
import { waitForEngine } from '../../engine/connection';
import { agentById, clientRecipe } from '../../engine/engines';
import { terminalRecipe } from '../../engine/linux/native';
import { canonicalizeContainerPath } from '../../engine/runner';
import { prepareAgentImage, useAgentsStore } from '../../state/agents';
import type { TerminalSession } from '../../state/app';
import { colorFgBg, type TermScheme } from './theme/palette';

export async function sessionRecipe(session: TerminalSession, scheme: TermScheme): Promise<PtyRecipe> {
  const agent = agentById(session.agentId);
  if (!agent) throw new Error('this agent no longer exists');
  const recipe = session.kind === 'tui' ? await tuiRecipe(agent, session.dir) : await linuxRecipe(agent);
  // An engine start reaps every process carrying the agent tag, so a PTY
  // with it would die the next time that engine starts.
  const env: Record<string, string> = { ...recipe.env, COLORFGBG: colorFgBg(scheme) };
  delete env.PHONECANDO_AGENT;
  return { ...recipe, env };
}

async function tuiRecipe(agent: Agent, dir: string): Promise<PtyRecipe> {
  // The engine may be stopped (idle stop in the background). A fresh start
  // needs a few seconds; waitForEngine bridges the gap so the first open
  // attaches instead of erroring.
  const res = await useAgentsStore.getState().startAgent(agent.id);
  console.log(`[phonecando] engine ensure: ${res.status} port=${res.port}`);
  if (res.status === 'started') {
    await waitForEngine(agent.id);
  } else if (res.port == null) {
    console.warn(`[phonecando] engine ensure failed err=${res.error ?? res.status}`);
  }
  // Rendered natively from the kind's manifest (its terminal client): the
  // agent's HOME, its engine's address and password, and the folder.
  return clientRecipe(agent.id, canonicalizeContainerPath(dir));
}

async function linuxRecipe(agent: Agent): Promise<PtyRecipe> {
  // Same preparation an engine start gets (the same guest env list too), so
  // the shell finds the image ready and launch.conf stays as the engine's.
  await prepareAgentImage(agent);
  // A login shell edits its own line: it must start on a cooked tty, or
  // readline treats echo as off and what you type never shows. The recipe's
  // handOver says whether the launcher hands the terminal to a guest shell.
  return { ...terminalRecipe(agent.imageId), raw: false };
}
