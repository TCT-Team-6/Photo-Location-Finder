import { test, expect, type Page } from '@playwright/test';

async function bounds(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, position: getComputedStyle(element).position };
    };
    return {
      scrollY, viewport: innerWidth, width: document.documentElement.scrollWidth,
      stage: rect('[data-testid="stage-optical-loupe"]'),
      heading: rect('h1'), intro: rect('.wa-hero-intro'),
    };
  });
}

test.describe('desktop photo pin geometry', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test('loading and ready photo stay after the intro; pin only at top; clean up on navigation', async ({ page }) => {
    let releaseImage!: () => void;
    const imageGate = new Promise<void>((resolve) => { releaseImage = resolve; });
    await page.route('**/examples/mariposa-grove.webp', async (route) => { await imageGate; await route.continue(); });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const stage = page.getByTestId('stage-optical-loupe');
    try {
      await expect(stage).toHaveAttribute('data-engine-state', 'loading');
      await expect(page.locator('html')).toHaveClass(/lenis/);
      const loading = await bounds(page);
      expect(loading.scrollY).toBe(0);
      expect(loading.stage.position).toBe('relative');
      expect(loading.stage.top).toBeGreaterThan(Math.max(loading.heading.bottom, loading.intro.bottom));
    } finally { releaseImage(); }
    await expect(stage).not.toHaveAttribute('data-engine-state', 'loading');
    await page.evaluate(() => document.fonts.ready);
    const initial = await bounds(page);
    expect(initial.stage.top).toBeGreaterThan(Math.max(initial.heading.bottom, initial.intro.bottom));
    expect(initial.width).toBe(initial.viewport);
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), initial.stage.top - 80);
    await expect.poll(async () => (await bounds(page)).stage.top).toBeCloseTo(80, 0);
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), initial.stage.top + 200);
    await expect(stage).toHaveCSS('position', 'fixed');
    expect(Math.abs((await bounds(page)).stage.top)).toBeLessThan(1);
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), initial.stage.top + 800);
    await expect.poll(async () => (await bounds(page)).stage.top).toBeLessThan(-100);
    await page.getByTestId('link-see-sample-case').evaluate((element) => (element as HTMLElement).click());
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
  });
});

test.describe('touch photo flow', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('no intro overlap, horizontal overflow or mobile photo pin', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('stage-optical-loupe')).not.toHaveAttribute('data-engine-state', 'loading');
    await page.evaluate(() => document.fonts.ready);
    const initial = await bounds(page);
    expect(initial.stage.top).toBeGreaterThan(Math.max(initial.heading.bottom, initial.intro.bottom));
    expect(initial.width).toBe(initial.viewport);
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), initial.stage.top + 200);
    await expect.poll(async () => (await bounds(page)).stage.top).toBeLessThan(-190);
    await expect(page.getByTestId('stage-optical-loupe')).toHaveCSS('position', 'relative');
    expect((await bounds(page)).width).toBe(initial.viewport);
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
  });
});
