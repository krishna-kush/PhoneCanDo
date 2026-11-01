import { defineConfig } from 'astro/config';

// Static output only: no server. Deploy dist/ anywhere.
export default defineConfig({
  site: 'https://phonecando.app',
  build: { inlineStylesheets: 'auto' },
});
