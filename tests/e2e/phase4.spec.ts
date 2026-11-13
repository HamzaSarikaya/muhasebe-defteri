import {readFile} from 'node:fs/promises';
import {expect, test, type BrowserContext} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {owner} from '../fixtures/dashboard-data';
import {istanbulToday} from '../../lib/finance/analytics';

async function session(context: BrowserContext, id = owner) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({alg: 'HS256', typ: 'JWT'})}.${encode({sub: id, aud: 'authenticated', exp: expires, iat: expires - 3600, role: 'authenticated'})}.fixture`;
  await context.addCookies([{name: 'sb-127-auth-token', value: 'base64-' + encode({access_token: token, refresh_token: 'fixture', expires_at: expires, expires_in: 3600, token_type: 'bearer', user: {id}}), domain: 'localhost', path: '/'}]);
}

test('subscriptions reconcile annual and monthly costs, currencies and paused visibility', async ({page, context}) => {
  await session(context);
  await page.goto('/tr/subscriptions');
  await expect(page.locator('.summary-item dd.money')).toHaveText(['₺108,32', '₺1.299,89']);
  await expect(page.getByRole('heading', {name: 'Abonelik 01', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Abonelik 03', exact: true})).toHaveCount(0);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('heading', {name: 'Abonelik 03', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'USD', exact: true}).click();
  await expect(page.locator('.summary-item dd.money')).toHaveText(['$12,00', '$144,00']);
  await expect(page.getByRole('heading', {name: 'Abonelik 04', exact: true})).toBeVisible();
  await page.getByRole('link', {name: 'Switch to English'}).click();
  await expect(page).toHaveURL('/en/subscriptions');
  await expect(page.getByText('Monthly equivalent', {exact: true})).toBeVisible();
});

test('subscription create, edit, renewal, pause and delete flow refreshes server records', async ({page, context, isMobile}) => {
  await session(context, owner.slice(0, -1) + (isMobile ? '6' : '5'));
  await page.goto('/tr/subscriptions');
  await page.locator('.composer > summary').click();
  const form = page.locator('.composer form');
  await form.getByLabel('Ad', {exact: true}).fill('Abonelik 05');
  await form.getByLabel('Dönemlik ücret').fill('120,01');
  await form.getByLabel('Sonraki yenileme').fill(istanbulToday());
  await form.getByRole('button', {name: 'Kaydet', exact: true}).click();
  const row = page.locator('.subscription-row').filter({has: page.getByRole('heading', {name: 'Abonelik 05', exact: true})});
  await expect(row).toBeVisible();
  await row.locator('summary').click();
  await row.getByLabel('Sağlayıcı', {exact: true}).fill('Sağlayıcı 05');
  await row.getByRole('button', {name: 'Kaydet', exact: true}).click();
  await expect(row.locator('.subscription-name p')).toContainText('Sağlayıcı 05');
  await row.getByRole('button', {name: 'Sonraki döneme ilerlet'}).click();
  await expect(row.getByRole('button', {name: 'Sonraki döneme ilerlet'})).toHaveCount(0);
  await expect(row).not.toContainText('Bugün yenileniyor');
  await row.getByRole('combobox', {name: 'Durum', exact: true}).selectOption('false');
  await row.getByRole('button', {name: 'Kaydet', exact: true}).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('checkbox').check();
  await expect(row).toBeVisible();
  await row.locator('summary').click();
  await row.getByRole('combobox', {name: 'Durum', exact: true}).selectOption('true');
  await row.getByRole('button', {name: 'Kaydet', exact: true}).click();
  await expect(row.locator('.subscription-date small')).toHaveText('Sonraki yenileme');
  page.once('dialog', dialog => dialog.accept());
  await row.getByRole('button', {name: 'Sil', exact: true}).click();
  await expect(row).toHaveCount(0);
});

test('reports use dates, show category and installment detail, and export exact CSV and full JSON', async ({page, context}) => {
  await session(context);
  await page.goto('/tr/reports');
  await page.getByRole('button', {name: 'Temizle', exact: true}).click();
  await expect(page.getByRole('table')).toContainText('₺19.250,00');
  await expect(page.locator('.installment-calendar')).toContainText('İşlem 01');
  await expect(page.locator('.installment-calendar')).toContainText('₺9.000,00');
  await page.getByLabel('Ara', {exact: true}).fill('ALT HESAP 01');
  await expect(page.locator('.installment-calendar')).not.toContainText('İşlem 02');
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Filtreli CSV indir'}).click();
  const csvFile = await csvDownload;
  const csv = await readFile((await csvFile.path())!, 'utf8');
  expect(csv).toContain('"12000.00"');
  expect(csv).toContain('"collection"');
  expect(csv).not.toContain('"USD"');
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Tam yedek indir (JSON)'}).click();
  const jsonFile = await jsonDownload;
  const backup = JSON.parse(await readFile((await jsonFile.path())!, 'utf8'));
  expect(backup.ledger.transactions).toHaveLength(5);
  expect(backup.ledger.subscriptions).toHaveLength(4);
  expect(backup.ledger.subscriptions[0].amount).toBe('9999');
  await page.getByLabel('Başlangıç tarihi').fill('2027-12-31');
  await page.getByLabel('Bitiş tarihi').fill('2027-01-01');
  await expect(page.locator('#range-error')).toContainText('Başlangıç tarihi');
  await expect(page.getByRole('button', {name: 'Filtreli CSV indir'})).toBeDisabled();
});

test('transaction search filters both activity lists and reset restores records', async ({page, context}) => {
  await session(context);
  await page.goto('/tr/transactions');
  await page.getByLabel('Ara', {exact: true}).fill('ALT HESAP 01');
  await expect(page.getByRole('status')).toContainText('2 işlem, 1 tahsilat');
  await expect(page.locator('article').filter({hasText: 'İşlem 02'})).toHaveCount(0);
  await page.getByRole('region', {name: 'Kayıt filtreleri'}).getByRole('combobox', {name: 'Para birimi', exact: true}).selectOption('USD');
  await expect(page.getByRole('status')).toContainText('1 işlem, 0 tahsilat');
  await page.getByRole('button', {name: 'Temizle', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('5 işlem, 1 tahsilat');
});

test('phase 4 screens stay accessible, responsive and usable with reduced motion', async ({page, context}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await session(context);
  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const route of ['subscriptions', 'reports', 'transactions']) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      await page.goto('/tr/' + route);
      await expect(page.locator('h1')).toBeVisible();
      if (route === 'subscriptions') await page.locator('.composer > summary').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' ' + width).toBe(true);
      if (width === 390 || width === 1440) {
        await page.screenshot({path: test.info().outputPath(route + '-' + width + '.png'), fullPage: true});
        expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('signed-out and empty phase 4 states do not expose other account records', async ({page, context}) => {
  for (const route of ['subscriptions', 'reports']) {
    await page.goto('/en/' + route);
    await expect(page.getByLabel('Email', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Download full backup (JSON)'})).toHaveCount(0);
  }
  await session(context, owner.slice(0, -1) + '2');
  await page.goto('/en/subscriptions');
  await expect(page.locator('.summary-item dd.money')).toHaveText(['TRY 0.00', 'TRY 0.00']);
  await expect(page.getByText('No subscriptions in this currency', {exact: true})).toBeVisible();
  await page.goto('/en/reports');
  await expect(page.getByText('No activity in this selection')).toBeVisible();
});

test('large histories bound rendered rows, reset pages after search and export the complete ledger', async ({page, context}) => {
  await session(context, owner.slice(0, -3) + '099');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tr/transactions');
  const lists = page.locator('section.panel.ledger-block').filter({has: page.locator('article')});
  await expect(lists.first().locator('article')).toHaveCount(50);
  await expect(lists.last().locator('article')).toHaveCount(50);
  // The first list's navigation is always the transaction pager.
  const controls = page.locator('.page-controls').first();
  await controls.getByRole('button', {name: 'Sonraki'}).click();
  await expect(controls.getByRole('status')).toHaveText('Sayfa 2 / 24');
  await expect(lists.first().locator('article').first()).toContainText('İşlem 00051');
  await page.getByLabel('Ara', {exact: true}).fill('İŞLEM 01200');
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('İşlem 01200');
  await page.getByRole('button', {name: 'Temizle', exact: true}).click();
  await expect(controls.getByRole('status')).toHaveText('Sayfa 1 / 24');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Filtreli CSV indir'}).click();
  const file = await downloading;
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('İşlem 01200');
  expect(csv.split('\r\n').length).toBeGreaterThan(1200);
  await page.getByText('Borç veya harcama ekle', {exact: true}).click();
  const form = page.locator('details').filter({has: page.getByText('Borç veya harcama ekle', {exact: true})}).locator('form');
  await form.getByLabel('Açıklama', {exact: true}).fill('İşlem taslağı');
  await page.getByText('Borç veya harcama ekle', {exact: true}).click();
  await page.getByText('Borç veya harcama ekle', {exact: true}).click();
  await expect(form.getByLabel('Açıklama', {exact: true})).toHaveValue('İşlem taslağı');
  await page.getByText('Tahsilat kaydet', {exact: true}).click();
  await expect(page.getByRole('combobox', {name: 'Tahsil edilecek borç', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('native export requests a save location without claiming the file is saved', async ({page, context}) => {
  await session(context);
  await page.addInitScript(() => {
    (window as Window & {MuhasebeFiles?: {postMessage: (value: string) => void}; exportMessage?: string}).MuhasebeFiles = {postMessage(value) {
      (window as Window & {exportMessage?: string}).exportMessage = value;
    }};
  });
  await page.goto('/tr/reports');
  await page.getByRole('button', {name: 'Tam yedek indir (JSON)'}).click();
  await expect(page.locator('.export-tools [role="status"]')).toContainText('bir konum seçin');
  const message = await page.evaluate(() => (window as Window & {exportMessage?: string}).exportMessage);
  expect(JSON.parse(message!).content).toContain('muhasebe-ledger');
});
