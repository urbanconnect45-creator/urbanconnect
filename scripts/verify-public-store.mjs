import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { chromium } from 'playwright-core';

const requestedBaseUrl = process.env.URBANCONNECT_VERIFY_URL;
const baseUrl = requestedBaseUrl ?? 'http://localhost:8101';
const outputDir = path.resolve('test-artifacts');
const distDir = path.resolve('dist');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};
let server;

if (!requestedBaseUrl) {
  server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', baseUrl);
      const cleanPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      let filePath = path.join(distDir, cleanPath);
      const requestedStat = await fs.stat(filePath).catch(() => null);

      if (requestedStat?.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      } else if (!requestedStat) {
        filePath = path.join(distDir, cleanPath, 'index.html');
      }

      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(8101, '127.0.0.1', resolve));
}
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

await fs.mkdir(outputDir, { recursive: true });

const results = {
  desktopStore: false,
  storeNavigation: false,
  foodNavigation: false,
  signupFlow: false,
  signupRow: false,
  loginRow: false,
  authCardBorder: false,
  sellerChoice: false,
  onboardingPlans: false,
  sellerAccountStep: false,
  sellerRandomFill: false,
  sellerOtpGate: false,
  sellerPortalBackground: false,
  sellerPortalCard: false,
  sellerPortalRow: false,
  catalogLink: false,
  catalogAdminRoute: false,
  mobileCatalogAdmin: false,
  adminBranding: false,
  mobileStore: false,
  mobileNoOverflow: false,
  mobileHeaderCollapsed: false,
  mobileRegistrationOrder: false,
  registrationBackground: false,
  mobileLogin: false,
  mobileSignup: false,
  mobileInputNoZoom: false,
  viewportLocked: false,
  viewportContent: '',
  messagesVisible: false,
  riverParkVisible: false,
  consoleErrors: [],
};

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  desktop.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      results.consoleErrors.push(message.text());
    }
  });

  await desktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await desktop.getByText('Products from local stores', { exact: true }).waitFor();
  results.desktopStore = await desktop
    .getByText('Shop products from trusted local stores.', { exact: true })
    .isVisible();
  results.riverParkVisible = await desktop.evaluate(() =>
    document.body.innerText.toLowerCase().includes('river park'),
  );
  results.messagesVisible = await desktop.evaluate(() =>
    document.body.innerText.toLowerCase().includes('messages'),
  );
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'public-store-desktop.png'),
  });

  const shopButton = desktop.getByRole('button', {
    exact: true,
    name: 'Open stores',
  });
  await shopButton.click();
  await desktop.getByText('Find Stores Near You', { exact: true }).waitFor();
  results.storeNavigation = true;
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'stores-desktop.png'),
  });

  const foodButton = desktop.getByRole('button', {
    exact: true,
    name: 'Open food marketplace',
  });
  if ((await foodButton.count()) !== 1) {
    throw new Error('Expected one public-store Food button.');
  }
  await foodButton.click();
  await desktop.getByText('Food from sellers near you.', { exact: true }).waitFor();
  results.foodNavigation = true;

  const signInButton = desktop.getByRole('button', {
    exact: true,
    name: 'Open sign in',
  });
  if ((await signInButton.count()) !== 1) {
    throw new Error('Expected one public-store Sign in button.');
  }
  await signInButton.click();
  await desktop.getByText('How would you like to continue?', { exact: true }).waitFor();
  results.sellerChoice =
    (await desktop.getByText('Customer', { exact: true }).count()) === 1 &&
    (await desktop.getByText('Store owner', { exact: true }).count()) === 1;
  await desktop.getByText('Customer', { exact: true }).click();
  await desktop.getByText('Welcome back', { exact: true }).waitFor();
  const createAccountButton = desktop.getByRole('button', {
    exact: true,
    name: 'Create user account',
  });
  await createAccountButton.click();
  await desktop.getByText('Create your user account.', { exact: true }).waitFor();
  results.signupFlow = true;
  const signupHeroBox = await desktop
    .getByText('Join the marketplace built for everyday local shopping.', { exact: true })
    .boundingBox();
  const signupFormBox = await desktop
    .getByText('Create your user account.', { exact: true })
    .boundingBox();
  results.signupRow = Boolean(
    signupHeroBox &&
      signupFormBox &&
      signupHeroBox.x + signupHeroBox.width < signupFormBox.x,
  );
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'web-signup-row.png'),
  });

  await desktop.goto(`${baseUrl}/app/`, { waitUntil: 'networkidle' });
  await desktop.getByText('Welcome back', { exact: true }).waitFor();

  const heroBox = await desktop
    .getByText('Everything nearby, connected in one place.', { exact: true })
    .boundingBox();
  const formBox = await desktop.getByText('Welcome back', { exact: true }).boundingBox();
  results.loginRow = Boolean(
    heroBox &&
      formBox &&
      heroBox.x + heroBox.width < formBox.x,
  );
  results.authCardBorder = await desktop
    .getByText('Welcome back', { exact: true })
    .evaluate((element) => {
      let current = element.parentElement;

      while (current) {
        const style = window.getComputedStyle(current);
        const box = current.getBoundingClientRect();

        if (box.width > 900 && Number.parseFloat(style.borderTopWidth) >= 1) {
          return true;
        }

        current = current.parentElement;
      }

      return false;
    });
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'web-login-row.png'),
  });

  await desktop.goto(`${baseUrl}/business-registration/`, {
    waitUntil: 'networkidle',
  });
  await desktop.getByText('Create a store owner account after email verification.', { exact: true }).waitFor();
  results.catalogLink = (await desktop.getByRole('link', { exact: true, name: 'Open Catalog' }).count()) === 0;
  await desktop.getByRole('button', { exact: true, name: 'Store owner' }).click();
  await desktop.getByText('Tell us about your store.', { exact: true }).waitFor();
  await desktop.getByRole('button', { exact: true, name: 'Fill random test details' }).click();
  results.sellerRandomFill =
    (await desktop.getByLabel('Owner full name').inputValue()).length > 0 &&
    (await desktop.getByLabel('Business or store name').inputValue()).length > 0 &&
    (await desktop.getByLabel('Email', { exact: true }).inputValue()) === '' &&
    (await desktop.getByLabel('State').inputValue()).length > 0 &&
    (await desktop.getByLabel('Local government area').inputValue()).length > 0;
  await desktop.getByLabel('Owner full name').fill('Test Seller');
  await desktop.getByLabel('Business or store name').fill('Test Seller Shop');
  await desktop.getByLabel('Email', { exact: true }).fill('seller@example.com');
  await desktop.getByLabel('Phone / WhatsApp').fill('+2348000000000');
  await desktop.getByLabel('State').selectOption('Lagos');
  await desktop.getByLabel('Local government area').selectOption('Ikeja');
  await desktop.getByLabel('Street / pickup address').fill('12 Test Street');
  await desktop.getByLabel('What do you sell?').fill('Groceries and household items');
  await desktop.getByRole('button', { exact: true, name: 'Continue to plans' }).click();
  const planStep = desktop.locator('[data-plan-step]');
  await planStep.getByText('Launch plan', { exact: true }).waitFor();
  results.onboardingPlans =
    (await planStep.getByText('Free Plan', { exact: true }).count()) === 1 &&
    (await planStep.getByText('Gold Plan', { exact: true }).count()) === 1 &&
    (await planStep.getByText('Recommended: start with Free', { exact: true }).count()) === 1;
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'seller-plans-desktop.png'),
  });
  await desktop.getByRole('button', { exact: true, name: 'Start with Free Plan' }).click();
  await desktop.getByText('Create your seller login.', { exact: true }).waitFor();
  results.sellerAccountStep =
    (await desktop.getByLabel('Login email').inputValue()) === 'seller@example.com' &&
    (await desktop.getByLabel('Login email').getAttribute('readonly')) !== null &&
    (await desktop.getByLabel('Password', { exact: true }).count()) === 1 &&
    (await desktop.getByLabel('Confirm password', { exact: true }).count()) === 1;
  await desktop.route('**/functions/v1/request-seller-signup-otp', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ status: 'sent', expiresAt: new Date(Date.now() + 600000).toISOString() }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await desktop.route('**/functions/v1/complete-seller-signup', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ status: 'created' }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await desktop.getByLabel('Password', { exact: true }).fill('TestPassword123');
  await desktop.getByLabel('Confirm password', { exact: true }).fill('TestPassword123');
  await desktop.getByRole('checkbox').check();
  await desktop.getByRole('button', { exact: true, name: 'Create account' }).click();
  await desktop.waitForTimeout(1000);
  results.sellerOtpGate =
    (await desktop.getByText('Enter your email OTP.', { exact: true }).isVisible());
  if (!results.sellerOtpGate) {
    console.log({
      accountStatus: await desktop.locator('[data-account-status]').textContent(),
      accountStatusHidden: await desktop.locator('[data-account-status]').getAttribute('hidden'),
    });
  }
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'seller-account-desktop.png'),
  });

  await desktop.goto(`${baseUrl}/seller-portal/`, { waitUntil: 'networkidle' });
  await desktop.getByText('Manage products without the customer app nav.', { exact: true }).waitFor();
  const sellerPortalHeroBox = await desktop
    .getByText('Manage products without the customer app nav.', { exact: true })
    .boundingBox();
  const sellerPortalFormBox = await desktop
    .getByText('Store owner login', { exact: true })
    .boundingBox();
  results.sellerPortalRow = Boolean(
    sellerPortalHeroBox &&
      sellerPortalFormBox &&
      sellerPortalHeroBox.x + sellerPortalHeroBox.width < sellerPortalFormBox.x,
  );
  results.sellerPortalCard = await desktop
    .getByText('Store owner login', { exact: true })
    .evaluate((element) => {
      let current = element.parentElement;

      while (current) {
        const style = window.getComputedStyle(current);
        const box = current.getBoundingClientRect();

        if (
          box.width > 900 &&
          Number.parseFloat(style.borderTopWidth) >= 2 &&
          Number.parseFloat(style.borderTopLeftRadius) >= 12
        ) {
          return true;
        }

        current = current.parentElement;
      }

      return false;
    });
  results.sellerPortalBackground = await desktop.evaluate(() =>
    [...document.querySelectorAll('div')].some((element) =>
      window
        .getComputedStyle(element)
        .backgroundImage.includes('seller-registration-marketplace'),
    ),
  );
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'seller-portal-desktop.png'),
  });

  await desktop.goto(`${baseUrl}/admin-portal/`, { waitUntil: 'networkidle' });
  results.adminBranding = await desktop
    .getByText('View2Connect Admin Portal', { exact: true })
    .isVisible();
  await desktop.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'admin-login-desktop.png'),
  });

  await desktop.goto(`${baseUrl}/catalog-admin/`, { waitUntil: 'networkidle' });
  results.catalogAdminRoute = await desktop
    .getByText('View2Connect Admin Portal', { exact: true })
    .isVisible();

  const mobile = await browser.newPage({
    deviceScaleFactor: 1,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  results.viewportContent = await mobile.evaluate(
    () => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
  );
  results.viewportLocked =
    results.viewportContent.includes('maximum-scale=1') &&
    (results.viewportContent.includes('user-scalable=no') ||
      results.viewportContent.includes('user-scalable=0'));
  await mobile.getByText('Products from local stores', { exact: true }).waitFor();
  results.mobileStore = await mobile
    .getByText('Shop products from trusted local stores.', { exact: true })
    .isVisible();
  results.mobileNoOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  await mobile.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'public-store-mobile.png'),
  });
  await mobile.getByRole('button', { exact: true, name: 'Open sign in' }).click();
  await mobile.getByText('How would you like to continue?', { exact: true }).waitFor();
  await mobile.getByText('Customer', { exact: true }).click();
  await mobile
    .getByText('How would you like to continue?', { exact: true })
    .waitFor({ state: 'hidden' });
  await mobile.getByText('Welcome back', { exact: true }).waitFor();
  results.mobileLogin =
    (await mobile.getByText('Everything nearby, connected in one place.', { exact: true }).count()) ===
      0 &&
    (await mobile.getByText('CAC registered', { exact: true }).count()) === 1;
  results.mobileInputNoZoom = await mobile
    .getByPlaceholder('email@example.com', { exact: true })
    .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize) >= 16);
  await mobile.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'web-login-mobile.png'),
  });
  await mobile
    .getByRole('button', { exact: true, name: 'Create user account' })
    .click();
  await mobile.getByText('Create your user account.', { exact: true }).waitFor();
  await mobile.waitForTimeout(350);
  results.mobileSignup =
    (await mobile
      .getByText('Join the marketplace built for everyday local shopping.', { exact: true })
      .count()) === 0;
  await mobile.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'web-signup-mobile.png'),
  });

  await mobile.goto(`${baseUrl}/catalog-admin/`, { waitUntil: 'networkidle' });
  results.mobileCatalogAdmin =
    (await mobile.getByText('View2Connect Admin Portal', { exact: true }).isVisible()) &&
    (await mobile.getByText('Admin is desktop only', { exact: true }).count()) === 0;

  await mobile.goto(`${baseUrl}/business-registration/`, {
    waitUntil: 'networkidle',
  });
  await mobile
    .getByRole('button', { exact: true, name: 'Store owner' })
    .click();
  await mobile.getByText('Tell us about your store.', { exact: true }).waitFor();
  const mobileHeaderActions = mobile.locator('.site-header .header-actions');
  const headerHiddenBeforeToggle = await mobileHeaderActions.evaluate(
    (element) => window.getComputedStyle(element).display === 'none',
  );
  await mobile.getByRole('button', { exact: true, name: 'Open navigation' }).click();
  const headerVisibleAfterToggle = await mobileHeaderActions.evaluate(
    (element) => window.getComputedStyle(element).display !== 'none',
  );
  results.mobileHeaderCollapsed = headerHiddenBeforeToggle && headerVisibleAfterToggle;
  const mobileMainFormBox = await mobile
    .getByText('Tell us about your store.', { exact: true })
    .boundingBox();
  const mobileApprovalBox = await mobile
    .getByText('What View2Connect will check.', { exact: true })
    .boundingBox();
  results.mobileRegistrationOrder = Boolean(
    mobileMainFormBox &&
      mobileApprovalBox &&
      mobileMainFormBox.y < mobileApprovalBox.y,
  );
  results.registrationBackground = await mobile
    .locator('.registration-page')
    .evaluate((element) =>
      window
        .getComputedStyle(element)
        .backgroundImage.includes('seller-registration-marketplace.png'),
    );
  await mobile.screenshot({
    fullPage: true,
    path: path.join(outputDir, 'seller-registration-mobile.png'),
  });
} finally {
  await browser.close();
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

console.log(JSON.stringify(results, null, 2));

if (
  !results.desktopStore ||
  !results.storeNavigation ||
  !results.foodNavigation ||
  !results.signupFlow ||
  !results.signupRow ||
  !results.loginRow ||
  !results.authCardBorder ||
  !results.sellerChoice ||
  !results.onboardingPlans ||
  !results.sellerAccountStep ||
  !results.sellerRandomFill ||
  !results.sellerOtpGate ||
  !results.sellerPortalBackground ||
  !results.sellerPortalCard ||
  !results.sellerPortalRow ||
  !results.catalogLink ||
  !results.catalogAdminRoute ||
  !results.mobileCatalogAdmin ||
  !results.adminBranding ||
  !results.mobileStore ||
  !results.mobileNoOverflow ||
  !results.mobileHeaderCollapsed ||
  !results.mobileRegistrationOrder ||
  !results.registrationBackground ||
  !results.mobileLogin ||
  !results.mobileSignup ||
  !results.mobileInputNoZoom ||
  !results.viewportLocked ||
  results.messagesVisible ||
  results.riverParkVisible ||
  results.consoleErrors.length > 0
) {
  process.exitCode = 1;
}
