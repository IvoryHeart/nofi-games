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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [],
        // Ensure new service worker takes over immediately on update so users
        // get the latest code on the next page load instead of waiting for
        // every tab/PWA window to close. Without these, save/resume and other
        // post-launch features can stay invisible to existing visitors for
        // an entire session.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
      output: {
        // Keep each game in its own chunk (Vite already does this via dynamic
        // imports, but be explicit). Shared engine code gets its own chunk so
        // it's cached separately and not re-downloaded when a single game changes.
        manualChunks: {
          engine: ['./src/engine/GameEngine.ts', './src/engine/input.ts'],
        },
      },
    },
    // Increase the chunk warning limit — our game chunks are intentionally
    // larger than typical page components, and Vite's 500 kB default warning
    // is for page assets, not self-contained game bundles.
    chunkSizeWarningLimit: 600,
  },
});
