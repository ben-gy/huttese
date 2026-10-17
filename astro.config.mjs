// @ts-check
import { defineConfig } from 'astro/config';

// Fully static output – deployed to Cloudflare as Workers static assets (see wrangler.jsonc).
export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
