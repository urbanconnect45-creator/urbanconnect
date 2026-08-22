import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { chromium } from 'playwright-core';

let baseUrl = process.env.VIEW2CONNECT_JOURNEY_VERIFY_URL ?? 'http://127.0.0.1:8098';
let staticServer;
const outputDir = path.resolve('test-artifacts');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

await fs.mkdir(outputDir, { recursive: true });

if (process.env.VIEW2CONNECT_JOURNEY_STATIC_DIR) {
  const staticRoot = path.resolve(process.env.VIEW2CONNECT_JOURNEY_STATIC_DIR);
  staticServer = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const relativePath = pathname.replace(/^\/+/, '');
    const candidates = pathname.endsWith('/') || !relativePath
      ? [path.join(staticRoot, relativePath, 'index.html'), path.join(staticRoot, 'app', 'index.html')]
      : [path.join(staticRoot, relativePath), path.join(staticRoot, relativePath, 'index.html'), path.join(staticRoot, 'app', 'index.html')];
    const filePath = candidates.find((candidate) => {
      const resolved = path.resolve(candidate);
      return resolved.startsWith(`${staticRoot}${path.sep}`) && fsSync.existsSync(resolved) && fsSync.statSync(resolved).isFile();
    });

    if (!filePath) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = extension === '.html'
      ? 'text/html; charset=utf-8'
      : extension === '.js'
        ? 'text/javascript; charset=utf-8'
        : extension === '.css'
          ? 'text/css; charset=utf-8'
          : extension === '.png'
            ? 'image/png'
            : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    fsSync.createReadStream(filePath).pipe(response);
  });
  await new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', resolve);
  });
  const address = staticServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function screenshot(page, name) {
  await page.screenshot({
    fullPage: false,
    path: path.join(outputDir, `journey-${name}.png`),
  });
}

async function createPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  if (process.env.VIEW2CONNECT_JOURNEY_STATIC_DIR) {
    await page.addInitScript(() => {
      globalThis.process = {
        env: { EXPO_PUBLIC_URBANCONNECT_LOCAL_TEST_MODE: 'true' },
      };
    });
  }

  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  return { consoleErrors, context, page, pageErrors };
}

async function openAndWaitForAuth(page, pathname = '/') {
  const response = await page.goto(`${baseUrl}${pathname}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });

  if (response?.status() !== 200) {
    throw new Error(`${pathname} returned status ${response?.status() ?? 'unknown'}.`);
  }

  await page.waitForTimeout(4_100);
}

async function verifyOpening() {
  const result = await createPage({ width: 390, height: 844 });
  const { context, page } = result;

  try {
    const response = await page.goto(baseUrl, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });

    await page.waitForTimeout(350);
    await screenshot(page, 'opening-early-mobile');
    await page.waitForTimeout(850);
    await screenshot(page, 'opening-route-mobile');
    await page.waitForTimeout(1_350);
    await screenshot(page, 'opening-identity-mobile');

    const layout = await page.evaluate(() => ({
      height: window.innerHeight,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      width: window.innerWidth,
    }));

    return {
      consoleErrors: result.consoleErrors,
      layout,
      pageErrors: result.pageErrors,
      status: response?.status() ?? null,
    };
  } finally {
    await context.close();
  }
}

async function verifyDesktopOpening() {
  const result = await createPage({ width: 1440, height: 900 });
  const { context, page } = result;

  try {
    const response = await page.goto(baseUrl, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1_250);
    await screenshot(page, 'opening-desktop');

    const layout = await page.evaluate(() => ({
      height: window.innerHeight,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      width: window.innerWidth,
    }));

    return {
      consoleErrors: result.consoleErrors,
      layout,
      pageErrors: result.pageErrors,
      status: response?.status() ?? null,
    };
  } finally {
    await context.close();
  }
}

async function verifyMobileOpeningViewport(name, viewport) {
  const result = await createPage(viewport);
  const { context, page } = result;

  try {
    const response = await page.goto(baseUrl, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1_250);
    await screenshot(page, `opening-${name}`);
    const layout = await page.evaluate(() => ({
      height: window.innerHeight,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      width: window.innerWidth,
    }));

    return {
      consoleErrors: result.consoleErrors,
      layout,
      pageErrors: result.pageErrors,
      status: response?.status() ?? null,
    };
  } finally {
    await context.close();
  }
}

async function verifyCustomerTransition(
  viewport = { width: 390, height: 844 },
  screenshotName = 'customer-mobile',
) {
  const result = await createPage(viewport);
  const { context, page } = result;

  try {
    await openAndWaitForAuth(page);
    await page.getByRole('button', { exact: true, name: 'Open sign in' }).click();
    await page.getByText('Customer', { exact: true }).click();
    await page.getByPlaceholder('email@example.com', { exact: true }).fill(
      'buyer@test.urbanconnect.local',
    );
    await page.getByPlaceholder('Enter your password', { exact: true }).fill('password123');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.waitForTimeout(1_900);
    await screenshot(page, screenshotName);
    await page.getByText('Welcome back, Test.', { exact: true }).waitFor({ state: 'visible' });
    await page
      .getByText('Your marketplace is ready', { exact: true })
      .waitFor({ state: 'hidden', timeout: 10_000 });

    const layout = await page.evaluate(() => ({
      height: window.innerHeight,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      width: window.innerWidth,
    }));

    return {
      consoleErrors: result.consoleErrors,
      layout,
      pageErrors: result.pageErrors,
      reachedDashboard: true,
    };
  } finally {
    await context.close();
  }
}

async function verifySellerTransition() {
  const result = await createPage({ width: 1280, height: 820 });
  const { context, page } = result;

  try {
    await openAndWaitForAuth(page, '/seller-portal');
    await page.getByLabel('View2Connect is opening').waitFor({ state: 'hidden', timeout: 10_000 });
    await page.getByText('Store owner login', { exact: true }).waitFor({ state: 'visible' });
    await screenshot(page, 'seller-login-desktop');
    await page.getByPlaceholder('seller@example.com', { exact: true }).fill(
      'seller@test.urbanconnect.local',
    );
    await page.getByPlaceholder('Enter password', { exact: true }).fill('password123');
    await page.getByRole('button', { exact: true, name: 'Open dashboard' }).click();
    await page.waitForTimeout(1_900);
    await screenshot(page, 'store-owner-desktop');
    await page.getByText('Welcome back, Test', { exact: true }).waitFor({ state: 'visible' });
    await page.waitForTimeout(1_200);

    return {
      consoleErrors: result.consoleErrors,
      pageErrors: result.pageErrors,
      transitionRendered: true,
    };
  } finally {
    await context.close();
  }
}

async function verifyDispatchTransition() {
  const result = await createPage({ width: 390, height: 844 });
  const { context, page } = result;

  try {
    await openAndWaitForAuth(page, '/dispatch-login');
    await page
      .getByPlaceholder('dispatch@example.com or 08012345678', { exact: true })
      .fill('dispatch@test.urbanconnect.local');
    await page.getByPlaceholder('Enter password', { exact: true }).fill('password123');
    await page.getByRole('button', { exact: true, name: 'Login' }).click();
    await page.waitForTimeout(1_900);
    await screenshot(page, 'dispatch-mobile');
    await page.getByText('Welcome back, Test', { exact: true }).waitFor({ state: 'visible' });
    await page.waitForTimeout(1_200);

    return {
      consoleErrors: result.consoleErrors,
      pageErrors: result.pageErrors,
      transitionRendered: true,
    };
  } finally {
    await context.close();
  }
}

try {
  const results = {
    opening: await verifyOpening(),
    openingNarrow: await verifyMobileOpeningViewport('narrow-mobile', { width: 320, height: 568 }),
    openingLarge: await verifyMobileOpeningViewport('large-mobile', { width: 430, height: 932 }),
    openingDesktop: await verifyDesktopOpening(),
    customerNarrow: await verifyCustomerTransition(
      { width: 320, height: 568 },
      'customer-narrow-mobile',
    ),
    customer: await verifyCustomerTransition(),
    customerLarge: await verifyCustomerTransition(
      { width: 430, height: 932 },
      'customer-large-mobile',
    ),
    seller: await verifySellerTransition(),
    dispatch: await verifyDispatchTransition(),
  };

  console.log(JSON.stringify(results, null, 2));

  const hasErrors = Object.values(results).some(
    (result) => result.consoleErrors.length > 0 || result.pageErrors.length > 0,
  );
  const hasOverflow = Object.values(results).some(
    (result) => result.layout && !result.layout.noHorizontalOverflow,
  );

  if (hasErrors || hasOverflow) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise((resolve) => staticServer?.close(resolve) ?? resolve());
}
