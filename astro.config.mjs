// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://tools.dcln.me',
  vite: {
    plugins: [tailwindcss()],
    worker: {
      format: 'es',
    },
  },
  integrations: [preact({ compat: true }), sitemap()],
});
