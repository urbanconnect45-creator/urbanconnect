import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const baseUrl = process.env.VIEW2CONNECT_DISPATCH_VERIFY_URL ?? 'http://127.0.0.1:8097';
const outputDir = path.resolve('test-artifacts');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

await fs.mkdir(outputDir, { recursive: true });

async function verifyDispatch(name, viewport, expectDesktopHero) {
  const page = await browser.newPage({ isMobile: !expectDesktopHero, viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}/dispatch-login`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
  await page.getByText('Dispatch account access', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByPlaceholder('dispatch@example.com or 08012345678', { exact: true }).waitFor();
  await page.getByPlaceholder('Enter password', { exact: true }).waitFor();
  await page.getByRole('button', { exact: true, name: 'Show password' }).click();
  await page.getByRole('button', { exact: true, name: 'Hide password' }).waitFor();
  await page.getByText('Forgot Password?', { exact: true }).waitFor();

  const loginLayout = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    noVerticalOverflow: document.documentElement.scrollHeight <= window.innerHeight + 1,
  }));
  const desktopHeroCount = await page.getByText('Delivery operations', { exact: true }).count();
  await page.screenshot({ path: path.join(outputDir, `dispatch-login-${name}.png`) });

  await page.getByRole('button', { exact: true, name: 'Create dispatch account' }).click();
  await page.getByText('New dispatch rider', { exact: true }).waitFor();
  await page.getByPlaceholder('Dispatch rider name', { exact: true }).waitFor();
  await page.getByPlaceholder('dispatch@example.com', { exact: true }).waitFor();
  await page.getByPlaceholder('08012345678', { exact: true }).waitFor();
  const signupPasswordToggles = await page
    .getByRole('button', { exact: true, name: 'Show password' })
    .count();
  const signupConfirmToggle = await page
    .getByRole('button', { exact: true, name: 'Show confirmed password' })
    .count();
  const signupLayout = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
  }));
  await page.screenshot({
    fullPage: true,
    path: path.join(outputDir, `dispatch-signup-${name}.png`),
  });

  await page.close();
  return {
    consoleErrors,
    desktopHeroCorrect: expectDesktopHero ? desktopHeroCount === 1 : desktopHeroCount === 0,
    loginLayout,
    pageErrors,
    signupConfirmToggleVisible: signupConfirmToggle === 1,
    signupLayout,
    signupPasswordToggleVisible: signupPasswordToggles === 1,
    status: response?.status() ?? null,
  };
}

try {
  const results = {
    desktop: await verifyDispatch('desktop', { width: 1440, height: 960 }, true),
    narrowMobile: await verifyDispatch('320x568', { width: 320, height: 568 }, false),
    mobile: await verifyDispatch('390x844', { width: 390, height: 844 }, false),
  };

  console.log(JSON.stringify(results, null, 2));
  if (
    Object.values(results).some(
      (result) =>
        result.status !== 200 ||
        !result.desktopHeroCorrect ||
        !result.loginLayout.noHorizontalOverflow ||
        !result.loginLayout.noVerticalOverflow ||
        !result.signupLayout.noHorizontalOverflow ||
        !result.signupPasswordToggleVisible ||
        !result.signupConfirmToggleVisible ||
        result.consoleErrors.length > 0 ||
        result.pageErrors.length > 0,
    )
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
