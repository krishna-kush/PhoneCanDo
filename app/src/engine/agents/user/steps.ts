// The install script: one text in the custom agent form, the manifest's
// install steps. A blank line ends a step. Each step runs in its own shell
// with `set -e` and runs again when it fails, so lines that belong together
// (a cd and what runs there) stay in one step. Pure (zero RN imports).

export function stepsOf(script: string): string[] {
  return script
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((step) => step.trim())
    .filter((step) => step !== '');
}

export function scriptOf(steps: readonly string[]): string {
  return steps.join('\n\n');
}
