import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Importing from 'vitest/config' (rather than a triple-slash types
// reference) pulls in Vitest's module augmentation of Vite's UserConfig
// type too, so `test: {...}` below type-checks without needing a separate
// `/// <reference types="vitest/config" />` directive.
import { configDefaults } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Mirrors the "@/*" -> "src/*" path alias declared in tsconfig.app.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    proxy: {
      // Backend (Django) runs separately in dev. Everything is called through
      // relative /api and /media paths so the app never needs to know the
      // backend's origin (see shared/api/client.ts) - this proxy is what makes
      // that true in dev, nginx does the equivalent job in production.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
    // tests/e2e/**/*.spec.ts is Playwright's, not Vitest's - without this
    // exclusion Vitest's default include pattern picks up *.spec.ts too and
    // tries to run the Playwright file as a Vitest test.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
