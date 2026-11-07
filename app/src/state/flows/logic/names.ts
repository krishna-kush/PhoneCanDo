// Agent names: the kind's label, then "label 2", "label 3", … Pure.

/** The first free name for a new agent of a kind: `opencode`, else the lowest `opencode N` (N ≥ 2). */
export function nextAgentName(label: string, taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!used.has(label.toLowerCase())) return label;
  for (let n = 2; ; n++) {
    const name = `${label} ${n}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}
