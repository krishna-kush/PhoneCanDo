import { useEffect, useState } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { checkTools } from '../../../engine/linux/native';
import type { Image, MissingTools } from '../../../engine/linux/types';

// The commands the agents' kinds need (each manifest's requires.commands,
// once each) that their ready Linux machine lacks, and the line that
// installs them; null while unknown, for a machine without Linux, or kinds
// that name none. An agent's page passes just that agent; a machine's page
// every agent on it. Checked again once an install of one of them records
// a new version, and each time `again` changes (the machine page's Check
// again).
export function useMissingTools(
  agents: readonly Agent[],
  image: Image | undefined,
  linux: boolean,
  again = 0,
): MissingTools | null {
  // Strings, so a fresh array with the same commands or versions does not re-check.
  const commands = [...new Set(agents.flatMap((a) => commandsOf(a)))].join(' ');
  const versions = agents.map((a) => a.installedVersion ?? '').join(' ');
  const imageId = linux && image?.state === 'ready' ? image.id : null;
  const [tools, setTools] = useState<MissingTools | null>(null);

  useEffect(() => {
    setTools(null);
    if (!imageId || !commands) return;
    let live = true;
    checkTools(imageId, commands.split(' ')).then(
      (found) => {
        if (live) setTools(found);
      },
      () => {
        // Busy or gone: no hint rather than a wrong one.
      },
    );
    return () => {
      live = false;
    };
  }, [imageId, commands, versions, again]);

  return tools;
}

/** The commands an agent's kind names; empty when it names none. */
export function commandsOf(agent: Agent): readonly string[] {
  const kind = agentKind(agent.kind);
  return Array.isArray(kind.commands) ? kind.commands : [];
}
