import { test, expect } from '@playwright/test';

test('guided fixtures stay offline, grounded and clearly fictional', async ({ page }) => {
  test.setTimeout(90000);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(guide|cases|investigations)/.test(request.url()) && request.method() !== 'GET') writes.push(request.url());
  });
  for (const sample of ['alex', 'joe']) {
    await page.goto(`/guide-demo/${sample}`);
    await expect(page.getByText('Sample case, fictional data', { exact: true }).first()).toBeVisible();
    await expect(page.locator('a[href="tel:911"]')).toHaveCount(0);
    await expect(page.getByText(/Please call 911 now\./).first()).toBeVisible();
    await page.getByTestId('button-reply-no').click();
    // Saved followups are displayed one at a time.
    await page.getByTestId('button-reply-not-sure').click();
    if (sample === 'alex') await page.getByTestId('button-reply-not-sure').click();
    await page.getByTestId('button-guide-demo-run').click();
    await expect(page.getByTestId('status-guide-demo-progress')).toBeVisible();
    await expect(page.getByTestId('card-demo-action-map')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('button-why-map').click();
    await expect(page.getByTestId('list-why-map')).toBeVisible();
    const firstMap = await page.getByTestId('link-demo-open-map').getAttribute('href');
    expect(firstMap).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    // Prevent opening a third-party page; still exercise the user click handler.
    await page.getByTestId('link-demo-open-map').evaluate((el) => el.addEventListener('click', (event) => event.preventDefault()));
    await page.getByTestId('link-demo-open-map').click();
    await page.getByTestId('button-demo-mark-checked').click();
    await expect(page.getByTestId('link-demo-open-map')).not.toHaveAttribute('href', firstMap!);
    await page.getByTestId('button-demo-share').click();
    await expect(page.getByTestId('text-responder-summary')).toContainText('Sample case, fictional data');
    await expect(page.getByTestId('text-responder-summary')).toContainText('Called 911: No');
  }
  expect(writes).toEqual([]);
});

test('guide entry and fictional conversation fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/start');
  await expect(page.getByTestId('input-guide-entry')).toBeVisible();
  await expect(page.getByTestId('link-guide-regular-form')).toHaveText('Use the regular form instead.');
  await page.getByTestId('button-guide-example-0').click();
  await expect(page.getByTestId('input-guide-entry')).toHaveValue(/grandpa/);
  await page.goto('/guide-demo/joe');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByTestId('label-sample-case').first()).toBeAttached();
});
