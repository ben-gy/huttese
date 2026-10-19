// @ts-check
import { defineConfig } from 'astro/config';

// Fully static output – deployed to GitHub Pages by .github/workflows/deploy.yml (custom domain in public/CNAME).
export default defineConfig({
  site: 'https://huttese.benrichardson.dev',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
