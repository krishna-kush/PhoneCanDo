// Hint sentences on the agent page. Pure (zero RN imports).

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "This machine lacks git and rg, which the agent needs." */
export function missingToolsLine(tools: readonly string[]): string {
  return `This machine lacks ${list(tools)}, which the agent needs.`;
}

// Long lists read as a count; the command itself names every package.
const NAMED_MAX = 6;

/** "The reset removed what you installed: python3 and make." */
export function reinstallLine(packages: readonly string[]): string {
  if (packages.length > NAMED_MAX) {
    return `The reset removed ${packages.length} packages you installed. You can install them again in one go.`;
  }
  return `The reset removed what you installed: ${list(packages)}. You can install ${packages.length === 1 ? 'it' : 'them'} again in one go.`;
}

/** After a reset of an installed agent's machine: why "Reinstall <agent>" is offered. */
export function agentReinstallLine(agentName: string): string {
  return `The reset removed the system packages ${agentName} needs. Reinstall it to bring them back; your projects and chats stay.`;
}
