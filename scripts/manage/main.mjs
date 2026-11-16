// PhoneCanDo: one entry point for the repo's scripts. ./manage (a sh wrapper)
// runs this; ./manage help lists every command, grouped (usage.mjs).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { red } from '../terminal/style.mjs';
import { agent } from './commands/agent.mjs';
import { build, release } from './commands/apk-builds.mjs';
import { android, check, logos, prebuild, web, xterm } from './commands/dev.mjs';
import { image } from './commands/image.mjs';
import { apk, device } from './commands/phone.mjs';
import { data, limits, stats } from './commands/usage-data.mjs';
import { CommandFailed, UsageError } from './errors.mjs';
import { render } from './usage.mjs';

export const COMMANDS = {
  release,
  build,
  prebuild,
  android,
  check,
  logos,
  xterm,
  web,
  agent,
  image,
  apk,
  device,
  stats,
  limits,
  data,
};

/** Runs one command line; the exit code: 0, 2 for a usage error, else the failed command's. */
export function main(argv) {
  if (!argv.length || ['-h', '--help', 'help'].includes(argv[0])) {
    console.log(render());
    return 0;
  }
  try {
    const command = Object.hasOwn(COMMANDS, argv[0]) ? COMMANDS[argv[0]] : null;
    if (!command) throw new UsageError(`unknown command '${argv[0]}'; run ./manage help`);
    command(argv.slice(1));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(red(`manage: ${error.message}`));
      return 2;
    }
    if (error instanceof CommandFailed) return error.status;
    if (error.code === 'ENOENT') {
      console.error(red(`manage: ${error.path ?? 'a program'} is not installed or not on PATH`));
      return 127;
    }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
