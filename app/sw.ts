import {CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({request}) => request.mode === 'navigate',
      handler: new NetworkOnly()
    },
    {
      matcher: ({url}) => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'muhasebe-static-v1',
        plugins: [new ExpirationPlugin({maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60})]
      })
    }
  ],
  fallbacks: {
    entries: [{url: '/offline.html', matcher: ({request}) => request.destination === 'document'}]
  }
});

serwist.addEventListeners();
