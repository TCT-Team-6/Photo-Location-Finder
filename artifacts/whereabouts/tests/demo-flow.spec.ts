import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

type DemoCase = {
  scenario: string;
  imageUrl: string;
  sourceImageUrl: string;
  sourceName: string;
  licenseUrl: string;
  investigation: {
    id: string;
    title: string;
    originalName: string;
    summary: string;
    context: string;
    clues: { label: string; observation: string; significance: string }[];
    candidates: {
      place: string; region: string; country: string; confidence: number;
      rationale: string; clues: string[]; mapsUrl: string;
    }[];
  };
};

const cases = JSON.parse(readFileSync(
  new URL('../src/lib/demo-cases.json', import.meta.url), 'utf8',
)) as DemoCase[];
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function verifyResult(page: import('@playwright/test').Page, sample: DemoCase) {
  const { investigation: record } = sample;
  await expect(page.getByTestId('text-demo-result-title')).toHaveText(record.title);
  await expect(page.getByTestId('text-demo-summary')).toHaveText(record.summary);
  await expect(page.getByTestId('panel-demo-summary')).toContainText(record.context);
  await expect(page.getByTestId('panel-demo-original-photo')).toContainText(record.originalName);
  await expect(page.getByTestId('link-demo-photo-source')).toHaveAttribute('href', sample.sourceImageUrl);
  await expect(page.getByTestId('link-demo-photo-license')).toHaveAttribute('href', sample.licenseUrl);
  await expect.poll(() => page.getByTestId('img-demo-result-original').evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
  )).toBe(true);
  await expect(page.getByTestId('notice-demo-boundary')).toHaveCount(1);
  await expect(page.getByTestId('notice-demo-boundary')).toHaveText('Sample cases with fictional scenarios. Real searches run the full AI pipeline.');
  await expect(page.getByTestId('panel-demo-family')).toContainText('What the family told us');
  await expect(page.getByTestId('status-urgency-level')).toHaveText(
    record.id === 'sample-grandparent' ? 'Critical urgency' : 'High urgency',
  );
  if (record.id === 'sample-grandparent') await expect(page.getByTestId('panel-demo-family')).toContainText('Age 78');
  await expect(page.getByText('Precomputed sample', { exact: true })).toBeVisible();
  await expect(page.getByTestId('link-demo-sign-in')).toHaveAttribute('href', '/sign-in');
  await expect(page.getByTestId('link-demo-sign-in')).toBeVisible();

  for (const [index, clue] of record.clues.entries()) {
    const item = page.getByTestId(`item-demo-clue-${index}`);
    await expect(item).toContainText(clue.label);
    await expect(item).toContainText(clue.observation);
    await expect(item).toContainText(clue.significance);
  }
  for (const [index, candidate] of record.candidates.entries()) {
    const card = page.getByTestId(`card-demo-candidate-${index}`);
    const score = Math.round(Math.max(0, Math.min(1, candidate.confidence)) * 100);
    const [lat, lng] = new URL(candidate.mapsUrl).searchParams.get('query')!.split(',').map(Number);
    await expect(card).toContainText(candidate.place);
    await expect(card).toContainText(candidate.region);
    await expect(card).toContainText(candidate.country);
    await expect(card).toContainText(candidate.rationale);
    for (const clue of candidate.clues) await expect(card).toContainText(clue);
    await expect(page.getByTestId(`text-demo-candidate-score-${index}`)).toHaveText(`Match score ${score} / 100`);
    await expect(page.getByTestId(`text-demo-candidate-coordinates-${index}`))
      .toHaveText(`Sample coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    await expect(page.getByTestId(`link-demo-candidate-map-${index}`)).toHaveAttribute('href', candidate.mapsUrl);
  }
}

test('anonymous demo journey uses only stored scenery results', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const requests: { method: string; url: string }[] = [];
  // Attach before the first navigation so the complete journey is monitored.
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto('/demo');
  const appOrigin = new URL(page.url()).origin;
  const ids = cases.map((sample) => sample.investigation.id);
  expect(ids).toEqual(['sample-lost-hiker', 'sample-grandparent', 'sample-child-separated']);
  await expect(page.getByTestId('link-demo-sign-in')).toHaveAttribute('href', '/sign-in');
  await expect(page.getByTestId('link-demo-sign-in')).toBeVisible();

  for (const view of ['overview', 'library'] as const) {
    await page.getByTestId(`button-demo-nav-${view}`).click();
    await expect(page.getByRole('heading', {
      name: view === 'overview' ? 'A field desk, in miniature.' : 'My library.',
    })).toBeVisible();
    await expect(page.getByTestId('link-demo-sign-in')).toHaveAttribute('href', '/sign-in');
    for (const sample of cases) {
      for (const affordance of ['open', 'view-result'] as const) {
        const buttonTestId = affordance === 'open'
          ? `button-open-demo-sample-${sample.investigation.id}`
          : `button-view-result-${sample.investigation.id}`;
        await page.getByTestId(buttonTestId).click();
        await verifyResult(page, sample);
        if (view === 'overview' && sample.investigation.id === ids[0] && affordance === 'open') {
          await page.getByTestId('button-select-demo-candidate-1').click();
          await expect(page.getByTestId('button-select-demo-candidate-1')).toHaveAttribute('aria-pressed', 'true');
          await expect(page.getByTestId('text-demo-map-note')).toContainText(
            `Selected map lead 2: ${sample.investigation.candidates[1].place}.`,
          );
        }
        await page.getByTestId('button-back-from-demo-result').click();
        await expect(page.getByRole('heading', {
          name: view === 'overview' ? 'A field desk, in miniature.' : 'My library.',
        })).toBeVisible();
        await expect(page.getByTestId('link-demo-sign-in')).toHaveAttribute('href', '/sign-in');
      }
    }
  }

  await page.getByTestId('button-demo-nav-investigate').click();
  await page.evaluate(() => {
    const w = window as typeof window & { __demoProgressRecords?: unknown[]; __demoProgressObserver?: MutationObserver };
    w.__demoProgressRecords = [];
    w.__demoProgressObserver?.disconnect();
    w.__demoProgressObserver = new MutationObserver(() => {
      const status = document.querySelector<HTMLElement>('[data-testid="status-demo-simulated-progress"]');
      const button = document.querySelector<HTMLButtonElement>('[data-testid="button-run-demo-sample"]');
      const login = document.querySelector<HTMLAnchorElement>('[data-testid="link-demo-sign-in"]');
       if (status || button?.disabled) {
        w.__demoProgressRecords!.push({ text: status?.innerText ?? '', disabled: !!button?.disabled, login: login?.getAttribute('href') });
      }
    });
    w.__demoProgressObserver.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  for (const sample of cases) {
    const id = sample.investigation.id;
    await page.getByTestId(`button-choose-sample-${id}`).click();
    await expect(page.getByTestId('select-demo-sample')).toHaveValue(id);
    await expect(page.getByTestId('button-choose-sample-' + id)).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('select-demo-sample').selectOption(cases.find((item) => item.investigation.id !== id)!.investigation.id);
    await page.getByTestId('select-demo-sample').selectOption(id);
    await expect(page.getByTestId('select-demo-sample')).toHaveValue(id);
    await expect(page.getByTestId('panel-demo-sample-picker')).toContainText(sample.investigation.title);
    await expect(page.getByTestId('link-demo-sign-in')).toHaveAttribute('href', '/sign-in');
    await expect(page.getByTestId('link-demo-sign-in')).toBeVisible();
    await page.evaluate(() => {
      (window as typeof window & { __demoProgressRecords: unknown[] }).__demoProgressRecords = [];
    });
    await page.getByTestId('button-run-demo-sample').click();
    await expect.poll(() => page.evaluate(() =>
      (window as typeof window & { __demoProgressRecords: { text: string; disabled: boolean; login: string }[] })
        .__demoProgressRecords.some((entry) => entry.text.includes('Sample walkthrough')
          && entry.text.includes('Checking photo metadata & authenticity') && entry.disabled && entry.login === '/sign-in'),
    ), { timeout: 3000 }).toBe(true);
    await expect(page.getByTestId('text-demo-result-title')).toHaveText(sample.investigation.title, { timeout: 7000 });
    await verifyResult(page, sample);
    await page.getByTestId('button-back-from-demo-result').click();
    await expect(page.getByTestId('panel-demo-sample-picker')).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('link-demo-sign-in-mobile')).toBeVisible();
  await expect(page.getByTestId('link-demo-sign-in-mobile')).toHaveAttribute('href', '/sign-in');
  for (const view of ['overview', 'investigate', 'library'] as const) {
    await page.getByTestId(`button-demo-mobile-nav-${view}`).click();
    await expect(page.getByTestId('link-demo-sign-in-mobile')).toBeVisible();
    await expect(page.getByTestId('link-demo-sign-in-mobile')).toHaveAttribute('href', '/sign-in');
  }
  await page.getByTestId('button-demo-mobile-nav-library').click();

  const appWrites = requests.filter((request) => {
    const url = new URL(request.url);
    return writeMethods.has(request.method)
      && (url.origin === appOrigin || url.pathname.startsWith('/api'));
  });
  const apiRequests = requests.filter((request) => new URL(request.url).pathname.startsWith('/api'));
  const liveWrites = appWrites.filter((request) => /analy[sz]e|upload|save|investigation/i.test(request.url));
  expect(appWrites, `Application writes detected: ${JSON.stringify(appWrites)}`).toEqual([]);
  expect(liveWrites).toEqual([]);
  expect(apiRequests.filter((request) => writeMethods.has(request.method))).toEqual([]);
  testInfo.annotations.push({ type: 'network', description: `${requests.length} requests observed; /api requests: ${apiRequests.length}; application writes: ${appWrites.length}` });
});
