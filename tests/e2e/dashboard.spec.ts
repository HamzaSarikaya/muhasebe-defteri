import {expect, test, type BrowserContext} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {client01, owner} from '../fixtures/dashboard-data';

async function session(context: BrowserContext, id = owner) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({alg: 'HS256', typ: 'JWT'})}.${encode({sub: id, aud: 'authenticated', exp: expires, iat: expires - 3600, role: 'authenticated'})}.fixture`;
  await context.addCookies([{name: 'sb-127-auth-token', value: 'base64-' + encode({access_token: token, refresh_token: 'fixture', expires_at: expires, expires_in: 3600, token_type: 'bearer', user: {id}}), domain: 'localhost', path: '/'}]);
}

test('signed-out dashboard protects financial values and offers sign in', async ({page}) => {
  await page.goto('/tr');
  await expect(page.getByLabel('E-posta', {exact: true})).toBeVisible();
  await expect(page.locator('.summary-item dd.money')).toHaveText(['—', '—', '—']);
  await expect(page.getByText('İşlem 01', {exact: true})).toHaveCount(0);
});

test('overview reconciles currencies, card shares, charts and due dates without browser errors', async ({page, context}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await session(context);
  await page.goto('/tr');
  await expect(page.locator('.summary-item dd.money')).toHaveText(['₺15.000,00', '₺3.000,00', '₺15.000,00']);
  const card = page.locator('.bank-card').filter({has: page.getByRole('heading', {name: 'Kart 01', exact: true})});
  await expect(card.locator('.bank-balance strong')).toHaveText('₺16.250,00');
  await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow', '32.5');
  await expect(card.locator('.card-shares')).toContainText('₺9.000,00');
  await expect(page.getByText('Geçmiş işlem kuru eksik. Kart borcu hesaplanamıyor.')).toBeVisible();
  await expect(page.locator('.upcoming-list li').first()).toContainText('Gecikmiş');
  await expect(page.locator('.recharts-line')).toHaveCount(2);
  await page.getByText('Grafik verilerini görüntüle', {exact: true}).click();
  await expect(page.getByRole('table')).toContainText('₺15.000,00');
  await page.getByRole('button', {name: 'USD', exact: true}).click();
  await expect(page.locator('.summary-item dd.money')).toHaveText(['$100,00', '$0,00', '$0,00']);
  await page.getByRole('button', {name: 'TRY', exact: true}).click();
  await expect(page.locator('.recharts-line')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('client deep link shows subaccount progress, multi-currency balances and history', async ({page, context}) => {
  await session(context);
  await page.goto('/tr/clients');
  await page.getByRole('link', {name: 'Müşteri 01', exact: true}).click();
  await expect(page).toHaveURL('/tr/clients/' + client01);
  await expect(page.getByRole('heading', {name: 'Müşteri 01', exact: true})).toBeVisible();
  await expect(page.locator('.client-total')).toContainText('₺9.000,00');
  await expect(page.locator('.client-total')).toContainText('$100,00');
  await expect(page.getByRole('meter').first()).toHaveAttribute('aria-valuenow', '25');
  await expect(page.locator('.activity-list')).toContainText('Tahsilat');
  await page.getByRole('link', {name: 'Switch to English'}).click();
  await expect(page).toHaveURL('/en/clients/' + client01);
  await expect(page.getByRole('heading', {name: 'Activity history'})).toBeVisible();
  const nav = page.getByRole('navigation', {name: 'Primary navigation', exact: true});
  if (await nav.isVisible()) await expect(nav.getByRole('link', {name: 'Clients', exact: true})).toHaveAttribute('aria-current', 'page');
  const response = await page.goto('/en/clients/20000000-0000-0000-0000-000000000099');
  expect(response?.status()).toBe(404);
});

test('dashboard and client profile remain accessible and fit small screens with reduced motion', async ({page, context}) => {
  await session(context);
  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const route of ['/tr', '/tr/clients/' + client01]) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' ' + width).toBe(true);
      if (width === 390 || width === 1440) {
        await page.screenshot({path: test.info().outputPath((route === '/tr' ? 'dashboard' : 'client') + '-' + width + '.png'), fullPage: true});
        const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(result.violations).toEqual([]);
      }
    }
  }
});

test('empty accounts show real zero balances and useful empty states', async ({page, context}) => {
  await session(context, owner.slice(0, -1) + '2');
  await page.goto('/en');
  await expect(page.locator('.summary-item dd.money')).toHaveText(['TRY 0.00', 'TRY 0.00', 'TRY 0.00']);
  await expect(page.getByText('No activity in this currency')).toBeVisible();
  await expect(page.getByText('Keep track of your cards')).toBeVisible();
});

test('snapshot errors show recovery without misleading zero balances', async ({page, context}) => {
  await session(context, owner.slice(0, -1) + '3');
  await page.goto('/tr');
  await expect(page.getByRole('heading', {name: 'Bu sayfa yüklenemedi'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Yeniden dene'})).toBeVisible();
  await expect(page.locator('.summary-item dd.money')).toHaveCount(0);
});

test('large exact balances fit narrow screens and over-limit cards remain explicit', async ({page, context}) => {
  await session(context, owner.slice(0, -1) + '4');
  for (const width of [320, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/tr');
    await expect(page.locator('.summary-item dd.money').first()).toContainText('92.233.720.368.550.758,07');
    const card = page.locator('.bank-card').filter({has: page.getByRole('heading', {name: 'Kart 01', exact: true})});
    await expect(card).toContainText('Limit aşımı');
    await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/tr/clients/' + client01);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
