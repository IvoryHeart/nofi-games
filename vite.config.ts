import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Inject git commit hash at build time — available as __BUILD_HASH__ in source.
const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'NoFi.Games',
        short_name: 'NoFi.Games',
        description: 'Casual offline games collection — play anywhere, no wifi needed',
        theme_color: '#8B5E83',
        background_color: '#FEF0E4',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'icons/icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // injectManifest builds src/sw.ts (custom host-aware navigation fallback).
      // skipWaiting/clientsClaim/cleanupOutdatedCaches are called inside src/sw.ts.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // allow the pixi-vendor chunk
      },
    }),
  ],
  define: {
    __BUILD_HASH__: JSON.stringify(commitHash),
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // strip console.log/warn from production
        passes: 2,            // second pass catches more dead code
      },
    },
    rollupOptions: {
      // Multi-page (MPA): two HTML entries at repo root.
      //  - main   → index.html  (existing nofi.games app, unchanged behavior)
      //  - tycoon → tycoon.html (standalone Dice Tycoon app)
      // Vite dedupes shared modules (engine, storage, utils) into shared chunks.
      // The PWA workbox globPatterns already match **/*.html, so both entries
      // (and their asset bundles) get precached automatically.
      input: {
        main: resolve(__dirname, 'index.html'),
        tycoon: resolve(__dirname, 'tycoon.html'),
      },
      output: {
        // Keep each game in its own chunk (Vite already does this via dynamic
        // imports, but be explicit). Shared engine code gets its own chunk so
        // it's cached separately and not re-downloaded when a single game changes.
        // Pin pixi.js (Tycoon-only WebGL renderer) into its OWN vendor chunk so
        // it can never leak into the nofi `main` graph AND its presence can't
        // reshuffle the shared chunks (engine/registry/confetti) that `main`
        // references — keeping the nofi main bundle byte-stable.
        manualChunks(id: string) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi')) {
            return 'pixi-vendor';
          }
          if (id.endsWith('/src/engine/GameEngine.ts') || id.endsWith('/src/engine/input.ts')) {
            return 'engine';
          }
          return undefined;
        },
      },
    },
    // Increase the chunk warning limit — our game chunks are intentionally
    // larger than typical page components, and Vite's 500 kB default warning
    // is for page assets, not self-contained game bundles.
    chunkSizeWarningLimit: 600,
  },
});
