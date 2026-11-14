// Remotion's settings for the preview (`pnpm studio`). Renders go through
// our own commands (engine/render/), which pass theirs to the renderer.

import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./films/index.tsx');
Config.setPublicDir('./public');
