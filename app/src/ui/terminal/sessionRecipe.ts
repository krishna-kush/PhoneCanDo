// What a terminal session runs, built when it opens: the agent kind's
// terminal UI attached to that agent's engine, or a shell in the agent's
// Linux image. Both go through the same generic PTY (engine/terminal.ts),
// so the IME and sizing path is the same.
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import type { PtyRecipe } from '../../engine/agents/types';
import { engineConn, waitForEngine } from '../../engine/connection';
import { agentById, agentHome } from '../../engine/engines';
import { prepareImageForStart, terminalRecipe } from '../../engine/linux/native';
import { canonicalizeContainerPath } from '../../engine/runner';
import { getLibDir } from '../../engine/terminal';
import { useAgentsStore } from '../../state/agents';
import type { TerminalSession } from '../../state/app';

export async function sessionRecipe(session: TerminalSession): Promise<PtyRecipe> {
  const agent = agentById(session.agentId);
  if (!agent) throw new Error('this agent no longer exists');
  const recipe = session.kind === 'tui' ? await tuiRecipe(agent, session.dir) : await linuxRecipe(agent);
  // An engine start reaps every process carrying the agent tag, so a PTY
  // with it would die the next time that engine starts.
  const env = { ...recipe.env };
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
  const conn = engineConn(agent.id);
  let password = '';
  try {
    password = conn.password();
  } catch {
    // native bridge absent: the TUI shows the health error, nothing crashes
  }
  return agentKind(agent.kind).tui({
    libDir: getLibDir(),
    homeDir: agentHome(agent),
    projectDir: canonicalizeContainerPath(dir),
    serverUrl: conn.baseUrl,
    password,
  });
}

async function linuxRecipe(agent: Agent): Promise<PtyRecipe> {
  // Same preparation an engine start gets, so the shell finds the image ready.
  await prepareImageForStart(agent.imageId);
  // A login shell edits its own line: it must start on a cooked tty, or
  // readline treats echo as off and what you type never shows. The recipe's
  // handOver says whether the launcher hands the terminal to a guest shell.
  return { ...terminalRecipe(agent.imageId), raw: false };
}
