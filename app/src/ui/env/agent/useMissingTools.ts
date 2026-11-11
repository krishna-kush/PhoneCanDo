import { useEffect, useState } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { checkTools } from '../../../engine/linux/native';
import type { Image, MissingTools } from '../../../engine/linux/types';

// The commands the agent's kind needs (its manifest's requires.commands)
// that its ready Linux machine lacks, and the line that installs them; null
// while unknown, for a machine without Linux, or a kind that names none.
// Checked again once an install of the agent records a new version.
export function useMissingTools(agent: Agent | undefined, image: Image | undefined, linux: boolean): MissingTools | null {
  const kind = agent ? agentKind(agent.kind) : null;
  // One string, so a fresh array with the same commands does not re-check.
  const commands = (kind && Array.isArray(kind.commands) ? kind.commands : []).join(' ');
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
  }, [imageId, commands, agent?.installedVersion]);

  return tools;
}
