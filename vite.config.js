import { defineConfig } from 'vite';

// Preview hostnames are supplied per environment so no VM hostname is committed.
const allowedHosts = (process.env.PREVIEW_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  // Relative asset URLs so a build also works under a /repo-name/ Pages path.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts,
  },
});
