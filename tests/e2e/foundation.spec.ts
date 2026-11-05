import {expect, test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('root negotiates locale and all TR / EN modules respond without runtime errors', async ({page, request}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const root = await request.get('/', {headers: {'Accept-Language': 'en-US,en;q=0.9'}});
  expect(new URL(root.url()).pathname).toBe('/en');
  for (const [locale, heading] of [['tr', 'Genel bakış'], ['en', 'Overview']]) {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', {name: heading, exact: true})).toBeVisible();
    for (const route of ['clients', 'cards', 'transactions', 'subscriptions', 'reports', 'settings']) {
      const response = await page.goto(`/${locale}/${route}`);
      expect(response?.status(), `${locale}/${route}`).toBe(200);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('language switch preserves the current route, query and hash and remembers preference', async ({page}) => {
  await page.goto('/tr/cards?view=all#history');
  await page.getByRole('link', {name: 'Switch to English'}).click();
  await expect(page).toHaveURL('/en/cards?view=all#history');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', {name: 'Cards', exact: true})).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL('/en');
});

test('navigation is usable and highlights the active destination', async ({page, isMobile}) => {
  await page.goto('/tr');
  const nav = page.getByRole('navigation', {name: isMobile ? 'Mobil gezinme' : 'Ana gezinme', exact: true});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(isMobile ? 5 : 6);
  await nav.getByRole('link', {name: 'Kartlar', exact: true}).click();
  await expect(page).toHaveURL('/tr/cards');
  await expect(nav.getByRole('link', {name: 'Kartlar', exact: true})).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', {name: 'Ayarlar', exact: true}).last().click();
  await expect(page).toHaveURL('/tr/settings');
  await expect(page.getByText('Bağlantı ayarları bekleniyor')).toBeVisible();
});

test('small screens have no horizontal overflow and overview passes accessibility checks', async ({page}) => {
  const initialViewport = page.viewportSize();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/tr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `width ${width}`).toBe(true);
  }
  if (initialViewport) await page.setViewportSize(initialViewport);
  await page.goto('/tr');
  await page.screenshot({path: test.info().outputPath('overview.png'), fullPage: true});
  const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('unknown routes return 404 and allow returning to the workspace', async ({page}) => {
  const response = await page.goto('/en/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', {name: 'Page not found'})).toBeVisible();
  await page.getByRole('link', {name: 'Back to overview'}).click();
  await expect(page).toHaveURL('/en');
});

test('installable manifest and correctly sized PNG icons are served without locale redirects', async ({request}) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  for (const icon of manifest.icons) {
    const result = await request.get(icon.src);
    expect(result.status()).toBe(200);
    expect(result.headers()['content-type']).toContain('image/png');
    const png = await result.body();
    const size = Number(icon.sizes.split('x')[0]);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['cache-control']).toContain('no-store');
});

test('offline navigation shows a localized fallback and caches no account documents or API responses', async ({page, context}) => {
  await page.goto('/tr');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.goto('/en/cards');
  // Exercise request types that must never enter Cache Storage.
  await page.evaluate(async () => {
    await fetch('/en/cards?_rsc=privacy-check', {headers: {RSC: '1'}});
    await fetch('/api/privacy-check');
  });
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain('/offline.html');
  expect(cached.every(url => url === '/offline.html' || url.startsWith('/_next/static/') || url.startsWith('/icons/'))).toBe(true);
  await context.setOffline(true);
  try {
    await page.goto('/en/transactions');
    await expect(page.getByRole('heading', {name: 'No internet connection'})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/tr/clients');
    await expect(page.getByRole('heading', {name: 'İnternet bağlantısı yok'})).toBeVisible();
  } finally { await context.setOffline(false); }
  await page.getByRole('button', {name: 'Yeniden dene'}).click();
  await expect(page.getByRole('heading', {name: 'Müşteriler', exact: true})).toBeVisible();
});

test('a controlled page survives disconnect and reconnect without an automatic reload', async ({page, context}) => {
  await page.goto('/tr');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const sentinel = await page.evaluate(() => {
    const value = crypto.randomUUID();
    document.documentElement.dataset.connectionSentinel = value;
    return value;
  });
  await context.setOffline(true);
  await expect(page.locator('.connection-notice')).toContainText('Çevrimdışısınız');
  await context.setOffline(false);
  await expect(page.locator('.connection-notice')).toHaveCount(0);
  // Allow the old Serwist online reload handler enough time to fail this regression.
  await page.waitForTimeout(1200);
  await expect(page.locator('html')).toHaveAttribute('data-connection-sentinel', sentinel);
});

test('offline fallback remains usable on a narrow display and recovers the original deep link', async ({page, context}) => {
  await page.setViewportSize({width: 320, height: 640});
  await page.goto('/en');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await page.goto('/en/subscriptions');
    await expect(page.getByRole('heading', {name: 'No internet connection'})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({path: test.info().outputPath('offline-320.png'), fullPage: true});
  } finally { await context.setOffline(false); }
  await page.getByRole('button', {name: 'Try again'}).click();
  await expect(page).toHaveURL('/en/subscriptions');
  await expect(page.getByRole('heading', {name: 'Subscriptions', exact: true})).toBeVisible();
});
