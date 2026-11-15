import { defineConfig } from 'astro/config';
import subsetFonts from './build/subset-fonts.mjs';

// Static output only: no server. Deploy dist/ anywhere.
export default defineConfig({
  site: 'https://phonecando.app',
  build: { inlineStylesheets: 'auto' },
  integrations: [subsetFonts()],
});
