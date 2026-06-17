/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Custom service worker (vite-plugin-pwa injectManifest mode).
//
// Why custom: the default generateSW binds the SPA navigation fallback to a
// single URL (index.html). But www.nofi.games and tycoon.nofi.games are served
// by the SAME deployment/SW script. Each origin registers its own SW, yet the
// shared script must serve a DIFFERENT app shell per host, or the tycoon origin
// ends up showing the nofi.games grid on every cached navigation/reload.

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Precache the build manifest (both index.html and tycoon.html + all assets).
precacheAndRoute(self.__WB_MANIFEST);

// Host-aware SPA navigation fallback: the tycoon subdomain falls back to the
// standalone Tycoon app shell; every other host falls back to the nofi grid.
const shell = self.location.hostname.startsWith('tycoon.') ? 'tycoon.html' : 'index.html';
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(shell), {
    // Only true page navigations use the app shell; never hijack files/API.
    denylist: [/^\/api\//, /^\/assets\//, /^\/icons\//, /\.[^/]+$/],
  }),
);
