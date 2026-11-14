import { test, expect } from '@playwright/test';

test('exported PWA installs fallback, excludes APIs, and recovers online', async ({ page, context, request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  expect(manifestResponse.headers()['cache-control']).toContain('no-cache');
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/chat/', display: 'standalone' });
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png' }, { src: '/favicon.ico' }]) {
    expect((await request.get(icon.src)).ok()).toBeTruthy();
  }
  const sw = await request.get('/sw.js');
  expect(sw.headers()['content-type']).toContain('javascript');
  expect(sw.headers()['cache-control']).toContain('no-cache');
  await page.goto('/chat/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
  });
  const unauthorized = await page.evaluate(async () => (await fetch('/api/transactions')).status);
  expect(unauthorized).toBe(401);
  await context.setOffline(true);
  await page.goto('/transactions/?transaction=private');
  await expect(page.getByRole('heading', { name: 'Money Tracker needs a connection' })).toBeVisible();
  // Even document navigations to API/auth URLs must never get the HTML fallback.
  const apiOffline = await page.evaluate(async () => {
    try { await fetch('/api/session'); return false; } catch { return true; }
  });
  expect(apiOffline).toBe(true);
  const cached = await page.evaluate(async () => {
    const result: string[] = [];
    for (const name of await caches.keys()) {
      for (const key of await (await caches.open(name)).keys()) result.push(new URL(key.url).pathname);
    }
    return result;
  });
  expect(cached).toEqual(['/offline/']);
  await page.screenshot({ path: `test-results/pwa-offline-${test.info().project.name}.png` });
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(page.getByRole('heading', { name: 'Money Tracker needs a connection' })).toHaveCount(0);
  await page.goto('/chat/');
  await expect(page.getByRole('button', { name: 'Continue with Google' }).first()).toBeVisible();
});
