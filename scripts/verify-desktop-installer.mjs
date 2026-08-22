import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const executablePath = path.resolve('release', 'win-unpacked', 'View2Connect Seller Portal.exe');
const outputDir = path.resolve('test-artifacts');
const debuggingPort = 9337;

await fs.mkdir(outputDir, { recursive: true });

const desktopEnvironment = {
  ...process.env,
  VIEW2CONNECT_DESKTOP_DEBUG_PORT: String(debuggingPort),
};
delete desktopEnvironment.ELECTRON_RUN_AS_NODE;

const desktopProcess = spawn(executablePath, [], {
  env: desktopEnvironment,
  stdio: 'ignore',
  windowsHide: true,
});

async function waitForDebuggingEndpoint() {
  const endpoint = `http://127.0.0.1:${debuggingPort}`;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) {
        return endpoint;
      }
    } catch {
      // The packaged runtime is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('The packaged desktop app did not expose its debugging endpoint.');
}

let browser;

try {
  browser = await chromium.connectOverCDP(await waitForDebuggingEndpoint());
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? await context.waitForEvent('page');
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.waitForFunction(
    () =>
      document.body.textContent?.includes('MARKETPLACE CONNECTED') ||
      Boolean(document.querySelector('[aria-label="View2Connect is opening"]')),
    undefined,
    { timeout: 15_000 },
  );
  const openingProbe = await page.evaluate(() => {
    const labelled = document.querySelector('[aria-label="View2Connect is opening"]');
    const bounds = labelled?.getBoundingClientRect();
    const style = labelled ? getComputedStyle(labelled) : null;
    return {
      backgroundCount: Array.from(document.querySelectorAll('*')).filter((element) =>
        getComputedStyle(element).backgroundImage.includes('opening-desktop'),
      ).length,
      bounds: bounds ? { height: bounds.height, width: bounds.width } : null,
      found: Boolean(labelled),
      opacity: style?.opacity ?? null,
      textPresent: document.body.textContent?.includes('MARKETPLACE CONNECTED') ?? false,
      visibility: style?.visibility ?? null,
    };
  });
  const openingVisible = openingProbe.textPresent || (
    openingProbe.found &&
    (openingProbe.bounds?.width ?? 0) > 0 &&
    (openingProbe.bounds?.height ?? 0) > 0 &&
    openingProbe.visibility !== 'hidden'
  );
  await page.screenshot({
    path: path.join(outputDir, 'desktop-installer-opening.png'),
    scale: 'css',
  });

  await page.waitForTimeout(3_600);
  await page.getByLabel('View2Connect is opening').waitFor({ state: 'hidden', timeout: 10_000 });
  await page.getByText('Store owner login', { exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({
    path: path.join(outputDir, 'desktop-installer-seller-login.png'),
    scale: 'css',
  });

  const runtime = await page.evaluate(() => ({
    body: {
      height: document.body.getBoundingClientRect().height,
      width: document.body.getBoundingClientRect().width,
    },
    devicePixelRatio: window.devicePixelRatio,
    document: {
      height: document.documentElement.getBoundingClientRect().height,
      width: document.documentElement.getBoundingClientRect().width,
    },
    height: window.innerHeight,
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    root: (() => {
      const root = document.getElementById('root');
      const bounds = root?.getBoundingClientRect();
      const childBounds = root?.firstElementChild?.getBoundingClientRect();
      return bounds ? {
        child: childBounds ? { height: childBounds.height, width: childBounds.width } : null,
        height: bounds.height,
        width: bounds.width,
      } : null;
    })(),
    userAgent: navigator.userAgent,
    width: window.innerWidth,
  }));
  const result = {
    consoleErrors,
    openingProbe,
    openingVisible,
    pageErrors,
    registrationActionHidden:
      (await page.getByText('Apply for a store owner account', { exact: true }).count()) === 0,
    runtime,
    sellerLoginVisible: await page.getByText('Store owner login', { exact: true }).isVisible(),
    url: page.url(),
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    consoleErrors.length > 0 ||
    !openingVisible ||
    pageErrors.length > 0 ||
    !runtime.noHorizontalOverflow ||
    !runtime.userAgent.includes('View2ConnectSellerDesktop/1.0.4') ||
    !result.registrationActionHidden ||
    !result.sellerLoginVisible ||
    !result.url.includes('/seller-portal/?desktopApp=1')
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  desktopProcess.kill();
}
