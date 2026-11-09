import { test, expect } from '@playwright/test';

const samples = [
  { id: 'sample-lost-hiker', nickname: 'Alex', level: 'High', elapsed: '5h 0m', radius: 15 },
  { id: 'sample-grandparent', nickname: 'Robin', level: 'Critical', elapsed: '3h 0m', radius: 3 },
  { id: 'sample-child-separated', nickname: 'Jamie', level: 'High', elapsed: '0h 30m', radius: 0.375 },
  { id: 'sample-teen-night', nickname: 'Sam', level: 'Moderate', elapsed: '3h 0m', radius: 4.5 },
];

test('all four anonymous case files show family urgency, annotations and a printable plan', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (req) => {
    if (/\/api\/(investigations|analyze|uploads)/.test(req.url()) && req.method() !== 'GET') writes.push(req.url());
  });
  for (const sample of samples) {
    await page.goto(`/demo?case=${sample.id}`);
    await expect(page.getByTestId('text-demo-case-nickname')).toHaveText(sample.nickname);
    await expect(page.getByTestId('status-demo-urgency-badge')).toHaveText(`${sample.level} urgency`);
    await expect(page.getByTestId('text-demo-missing-counter')).toContainText(sample.elapsed);
    await expect(page.getByTestId('notice-demo-boundary')).toHaveCount(1);
    await expect(page.getByTestId('item-demo-header-risk-0')).toBeVisible();
    await expect(page.getByTestId('item-demo-header-risk-1')).toBeVisible();
    const header = await page.getByTestId('panel-demo-case-header').boundingBox();
    expect(header!.y + header!.height).toBeLessThan(720);
    await expect(page.getByTestId('box-demo-annotation-0')).toBeVisible();
    await page.getByTestId('button-toggle-ai-clues').click();
    await expect(page.getByTestId('box-demo-annotation-0')).toHaveCount(0);
    await expect(page.getByTestId('button-toggle-ai-clues')).toHaveText('Show AI clues');
    await page.getByTestId('button-toggle-ai-clues').click();
    await expect(page.getByTestId('row-demo-trail-4')).toBeVisible();
    await expect(page.getByTestId('chip-demo-trail-llm-1')).toHaveText('LLM');
    await expect(page.getByTestId('chip-demo-trail-llm-3')).toHaveText('LLM');
    await page.getByTestId('checkbox-demo-step-0').check();
    await expect(page.getByTestId('text-demo-checklist-count')).toContainText('1 /');
    await page.getByTestId('button-share-search-team').click();
    await expect(page.getByTestId('panel-demo-print-summary')).toContainText(sample.nickname);
    await expect(page.getByTestId('button-print-summary')).toBeVisible();
    await page.getByTestId('button-close-summary').click();
  }
  expect(writes).toEqual([]);
});

test('start flow requires authority confirmation and carries case details through progress', async ({ page }) => {
  await page.goto('/demo');
  await page.getByTestId('button-demo-nav-investigate').click();
  await page.getByTestId('input-demo-nickname').fill('Taylor');
  await page.getByTestId('button-demo-age-teen').click();
  await page.getByTestId('input-demo-care-notes').fill('Blue jacket');
  await page.getByTestId('button-demo-step-next').click();
  await page.getByTestId('button-choose-sample-sample-teen-night').click();
  await page.getByTestId('button-demo-step-next').click();
  await expect(page.getByTestId('button-run-demo-sample')).toBeDisabled();
  await page.getByTestId('button-demo-reason-welfare-check').click();
  await page.getByTestId('checkbox-demo-authorities').check();
  await page.getByTestId('button-run-demo-sample').click();
  await expect(page.getByTestId('status-demo-simulated-progress')).toBeVisible();
  await expect(page.getByTestId('text-demo-progress-stage')).toHaveText('Checking photo metadata & authenticity');
  await expect(page.getByTestId('text-demo-case-nickname')).toHaveText('Taylor', { timeout: 8000 });
  await expect(page.getByTestId('text-demo-care-notes')).toContainText('Blue jacket');
  await expect(page.getByTestId('status-demo-urgency-badge')).toHaveText('Moderate urgency');
});

test('case file stacks at 375px without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/demo?case=sample-grandparent');
  await expect(page.getByTestId('text-demo-case-nickname')).toHaveText('Robin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByTestId('button-share-search-team').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
