import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/** Separate vitest config for the auto-play agent. NOT part of `npm test`. */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['scripts/autoplay/**/*.test.ts'],
    testTimeout: 120000, // autoplay sessions can be long
  },
});
