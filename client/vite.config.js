import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Assets are emitted with root-absolute URLs (`/assets/…`). When the app is
// served under a sub-path (BASE_PATH), the server rewrites those prefixes and
// injects the mount point as `window.__APP_BASE__` at serve time — so a single
// build works at the root or behind a reverse proxy. See server/app.js and
// client/src/basePath.js.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8002',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
