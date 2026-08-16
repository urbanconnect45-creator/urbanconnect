import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const baseUrl = process.env.VIEW2CONNECT_DARK_AUTH_URL ?? 'http://127.0.0.1:8098';
const outputDir = path.resolve('test-artifacts');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

await fs.mkdir(outputDir, { recursive: true });

async function openDarkAuth(name, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    window.localStorage.setItem('urbanconnect.localTest.themeMode', JSON.stringify('dark'));
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(baseUrl, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4_500);
  await page.getByRole('button', { exact: true, name: 'Open sign in' }).click();
  await page.getByText('Customer', { exact: true }).click();
  await page.getByPlaceholder('email@example.com', { exact: true }).waitFor({ state: 'visible' });
  await page.waitForTimeout(650);

  await page.screenshot({
    fullPage: true,
    path: path.join(outputDir, `dark-auth-login-${name}.png`),
  });

  const inputColors = await page.getByPlaceholder('email@example.com', { exact: true }).evaluate(
    (element) => {
      const style = window.getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, color: style.color };
    },
  );
  const layout = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    viewportWidth: window.innerWidth,
  }));

  if (name === 'mobile') {
    await page.getByRole('button', { exact: true, name: 'Create user account' }).click();
    await page.getByText('Create your user account.', { exact: true }).waitFor({ state: 'visible' });
    await page.screenshot({
      fullPage: true,
      path: path.join(outputDir, 'dark-auth-signup-mobile.png'),
    });
  }

  await context.close();

  return {
    consoleErrors,
    inputColors,
    layout,
    pageErrors,
    status: response?.status() ?? null,
  };
}

try {
  const results = {
    mobile: await openDarkAuth('mobile', { width: 390, height: 844 }),
    desktop: await openDarkAuth('desktop', { width: 1440, height: 960 }),
  };

  console.log(JSON.stringify(results, null, 2));

  if (
    Object.values(results).some(
      (result) =>
        result.status !== 200 ||
        !result.layout.noHorizontalOverflow ||
        result.consoleErrors.length > 0 ||
        result.pageErrors.length > 0,
    )
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
