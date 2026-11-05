import type {NextConfig} from 'next';
import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production' || process.env.LEDGER_DASHBOARD_TEST === '1',
  // Reconnecting must not discard a partially completed form.
  reloadOnOnline: false,
  cacheOnNavigation: false,
  globPublicPatterns: ['icons/**/*'],
  // Never precache rendered pages or financial / authentication responses.
  exclude: [/\.map$/, /\.html$/, /\.json$/, /\.rsc$/, /\.txt$/, /middleware-manifest/],
  additionalPrecacheEntries: [{url: '/offline.html', revision: createHash('sha256').update(readFileSync('public/offline.html')).digest('hex')}]
});

const nextConfig: NextConfig = {
  distDir: process.env.LEDGER_DASHBOARD_TEST === '1' ? '.next-dashboard' : '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {source: '/:path*', headers: [
        {key: 'X-Content-Type-Options', value: 'nosniff'},
        {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
        {key: 'X-Frame-Options', value: 'DENY'}
      ]},
      {source: '/sw.js', headers: [
        {key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate'},
        {key: 'Service-Worker-Allowed', value: '/'}
      ]}
    ];
  }
};

export default withSerwist(withNextIntl(nextConfig));
