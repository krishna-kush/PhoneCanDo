// The machine page's look inside: one short sh script run in the machine
// (runGuestCommand), which prints what it finds as `key=value` lines: its
// CPU, and which common tools are there and their versions, for the
// inspection tag. Every command is ours, none typed by anyone. Pure (zero
// RN imports): scripts/vectors/test_machine_page.js checks it.

/** A common tool the look inside asks for, and the line that prints its version. */
type Tool = { id: string; label: string; version: string };

export const INSIDE_TOOLS: readonly Tool[] = [
  { id: 'git', label: 'Git', version: 'git --version' },
  { id: 'curl', label: 'curl', version: 'curl --version' },
  { id: 'python3', label: 'Python', version: 'python3 --version' },
  { id: 'node', label: 'Node.js', version: 'node --version' },
  { id: 'gcc', label: 'GCC', version: 'gcc --version' },
  { id: 'make', label: 'Make', version: 'make --version' },
  { id: 'go', label: 'Go', version: 'go version' },
  { id: 'rustc', label: 'Rust', version: 'rustc --version' },
];

/** Long enough for every tool's version under proot on a slow phone. */
export const INSIDE_TIMEOUT_SEC = 30;

/** The script, for `sh -c`: POSIX sh, so busybox's ash runs it too; nothing reads stdin. */
export function insideScript(): string {
  const lines = [
    'echo "arch=$(uname -m 2>/dev/null)"',
    'echo "cpus=$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null)"',
  ];
  for (const t of INSIDE_TOOLS) {
    lines.push(`command -v ${t.id} >/dev/null 2>&1 && echo "tool.${t.id}=$(${t.version} </dev/null 2>&1 | head -n 1)"`);
  }
  return `${lines.join('\n')}\n`;
}

export type Inside = {
  arch: string | null;
  cpus: number | null;
  /** Each found tool's id and its version line's version (null: found, no version read). Missing tools are absent. */
  tools: Record<string, string | null>;
};

/** The script's output read back; unknown lines are skipped. */
export function parseInside(stdout: string): Inside {
  const out: Inside = { arch: null, cpus: null, tools: {} };
  for (const raw of stdout.split('\n')) {
    const eq = raw.indexOf('=');
    if (eq <= 0) continue;
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (key.startsWith('tool.')) out.tools[key.slice('tool.'.length)] = versionOf(value);
    else if (key === 'arch') out.arch = value || null;
    else if (key === 'cpus') out.cpus = countOf(value);
  }
  return out;
}

/** The first dotted number in a version line: "git version 2.39.5" → "2.39.5", "go1.22.1" → "1.22.1". */
export function versionOf(line: string): string | null {
  const m = /(\d+(?:\.\d+)+)/.exec(line);
  return m ? m[1] : null;
}

function countOf(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "aarch64 · 8 cores"; null when it said neither. */
export function cpuLine(inside: Pick<Inside, 'arch' | 'cpus'>): string | null {
  const cores = inside.cpus ? `${inside.cpus} ${inside.cpus === 1 ? 'core' : 'cores'}` : null;
  return [inside.arch, cores].filter(Boolean).join(' · ') || null;
}
