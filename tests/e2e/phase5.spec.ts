import {expect, test, type BrowserContext} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {owner} from '../fixtures/dashboard-data';
import {istanbulToday} from '../../lib/finance/analytics';

async function session(context: BrowserContext, suffix: string) {
  const id = owner.slice(0, -2) + suffix;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({alg: 'HS256', typ: 'JWT'})}.${encode({sub: id, aud: 'authenticated', exp: expires, role: 'authenticated'})}.fixture`;
  await context.addCookies([{name: 'sb-127-auth-token', value: 'base64-' + encode({access_token: token, refresh_token: 'fixture', expires_at: expires, expires_in: 3600, token_type: 'bearer', user: {id}}), domain: 'localhost', path: '/'}]);
}

test('an offline save sends no request, preserves form values and can be retried once online', async ({page, context, isMobile}) => {
  await session(context, isMobile ? '12' : '11');
  await page.goto('/tr/subscriptions');
  await page.locator('.composer > summary').click();
  const form = page.locator('.composer form');
  const name = 'Abonelik 06';
  await form.getByLabel('Ad', {exact: true}).fill(name);
  await form.getByLabel('Dönemlik ücret').fill('123,45');
  await form.getByLabel('Sonraki yenileme').fill(istanbulToday());
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await context.setOffline(true);
  try {
    await expect(page.locator('.connection-notice')).toBeVisible();
    await form.getByRole('button', {name: 'Kaydet', exact: true}).click();
    await expect(form.getByRole('status')).toContainText('Formunuz bu ekranda korunuyor');
    await expect(form.getByLabel('Ad', {exact: true})).toHaveValue(name);
    await expect(form.getByLabel('Dönemlik ücret')).toHaveValue('123,45');
    expect(writes).toEqual([]);
  } finally { await context.setOffline(false); }
  await expect(page.locator('.connection-notice')).toHaveCount(0);
  await expect(form.getByLabel('Ad', {exact: true})).toHaveValue(name);
  await form.getByRole('button', {name: 'Kaydet', exact: true}).click();
  await expect(page.getByRole('heading', {name, exact: true})).toHaveCount(1);
  expect(writes).toHaveLength(1);
});

test('touch controls, landscape navigation and safe area clearances remain usable', async ({page, context, isMobile}) => {
  test.skip(!isMobile, 'Touch-specific checks use a mobile browser context.');
  await session(context, '13');
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[320, 640], [390, 844], [844, 390]]) {
    await page.setViewportSize({width, height});
    for (const route of ['', '/cards', '/clients', '/transactions', '/subscriptions', '/reports', '/settings']) {
      await page.goto('/tr' + route);
      await expect(page.locator('h1')).toBeVisible();
      // Streaming deliberately makes the heading available before financial content.
      await expect(page.locator('.route-loading')).toHaveCount(0);
      await expect(page.locator('.mobile-nav')).toBeVisible();
      // Simulate nonzero platform insets; emulators do not expose a physical notch.
      await page.addStyleTag({content: ':root { --safe-top: 24px; --safe-right: 16px; --safe-bottom: 34px; --safe-left: 16px; }'});
      const failures = await page.evaluate(() => {
        const issues: string[] = [];
        if (document.documentElement.scrollWidth > innerWidth) issues.push('horizontal overflow');
        const nav = document.querySelector('.mobile-nav')!;
        const style = getComputedStyle(nav);
        if (parseFloat(style.paddingBottom) < 34) issues.push('bottom inset');
        const header = document.querySelector('.topbar')!;
        if (parseFloat(getComputedStyle(header).paddingTop) < 24) issues.push('top inset');
        for (const item of document.querySelectorAll('a, button, summary, input:not([type="hidden"]), select')) {
          // A native checkbox's entire enclosing label is its touch target.
          const target = item instanceof HTMLInputElement && item.type === 'checkbox' ? item.closest('label') ?? item : item;
          const box = target.getBoundingClientRect();
          if (!box.width || !box.height) continue;
          if (box.height < 44 || box.width < 44) issues.push(`${item.tagName}: ${item.textContent?.trim().slice(0, 35)} ${box.width}x${box.height}`);
        }
        return issues;
      });
      expect(failures, route + ' at ' + width).toEqual([]);
      const nav = await page.locator('.mobile-nav').boundingBox();
      const main = page.locator('main');
      await main.evaluate(element => window.scrollTo(0, element.scrollHeight + element.getBoundingClientRect().top + scrollY));
      const last = page.locator('main a, main button, main summary').filter({visible: true}).last();
      const box = await last.boundingBox();
      if (box && nav) expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
    }
  }
  await page.goto('/en/subscriptions');
  await page.screenshot({path: test.info().outputPath('mobile-landscape.png'), fullPage: true});
  expect((await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});
