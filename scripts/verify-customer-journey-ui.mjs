import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const baseUrl = process.env.VIEW2CONNECT_JOURNEY_VERIFY_URL ?? 'http://127.0.0.1:8097';
const outputDir = path.resolve('test-artifacts');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

await fs.mkdir(outputDir, { recursive: true });

async function verifyJourney(name, viewport) {
  const page = await browser.newPage({ isMobile: true, viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(baseUrl, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  const openingTitle = page.getByText('Buy. Sell. Deliver.', { exact: true });
  await openingTitle.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(760);
  const beforeLogoReady = await page.locator('img').evaluateAll((images) =>
    images.some((image) => image.naturalWidth === 512 && image.naturalHeight === 512),
  );
  const beforeBackground = await openingTitle.evaluate((element) => {
    let current = element;
    while (current) {
      const color = window.getComputedStyle(current).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)') return color;
      current = current.parentElement;
    }
    return '';
  });
  await page.screenshot({ path: path.join(outputDir, `customer-opening-${name}.png`) });

  await page.getByRole('button', { exact: true, name: 'Open sign in' }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { exact: true, name: 'Open sign in' }).click();
  await page.getByText('Customer', { exact: true }).click();
  await page.getByPlaceholder('email@example.com', { exact: true }).fill('buyer@test.urbanconnect.local');
  await page.getByPlaceholder('Enter your password', { exact: true }).fill('local-audit-only');
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await page.getByText('Welcome back, Test.', { exact: true }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(900);
  const afterLogoReady = await page.locator('img').evaluateAll((images) =>
    images.some((image) => image.naturalWidth === 512 && image.naturalHeight === 512),
  );
  const readyTitle = page.getByText('Welcome back, Test.', { exact: true });
  const afterBackground = await readyTitle.evaluate((element) => {
    let current = element;
    while (current) {
      const color = window.getComputedStyle(current).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)') return color;
      current = current.parentElement;
    }
    return '';
  });
  await page.screenshot({ path: path.join(outputDir, `customer-ready-${name}.png`) });

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  await page.close();
  return {
    afterBackground,
    afterLogoReady,
    beforeBackground,
    beforeLogoReady,
    consoleErrors,
    noHorizontalOverflow,
    pageErrors,
    status: response?.status() ?? null,
  };
}

try {
  const results = {
    narrow: await verifyJourney('320x568', { width: 320, height: 568 }),
    regular: await verifyJourney('360x800', { width: 360, height: 800 }),
    standard: await verifyJourney('390x844', { width: 390, height: 844 }),
    large: await verifyJourney('430x932', { width: 430, height: 932 }),
  };
  console.log(JSON.stringify(results, null, 2));
  if (Object.values(results).some((result) =>
    result.status !== 200 ||
    !result.beforeLogoReady ||
    !result.afterLogoReady ||
    result.beforeBackground !== 'rgb(26, 6, 56)' ||
    result.afterBackground !== 'rgb(26, 6, 56)' ||
    !result.noHorizontalOverflow ||
    result.consoleErrors.length > 0 ||
    result.pageErrors.length > 0
  )) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
