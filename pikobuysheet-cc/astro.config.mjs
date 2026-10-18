import { defineConfig } from 'astro/config';
import sitesAdapter from './scripts/adapter.mjs';
export default defineConfig({
  site: 'https://pikobuysheet.cc',
  output: 'server',
  adapter: sitesAdapter(),
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'always' },
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  server: { host: '0.0.0.0', port: 4173 },
  vite: { server: { allowedHosts: ['terminal.local'] } }
});
