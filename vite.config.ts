import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' lets the built app run from any folder or static host (e.g. Cloudflare Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
