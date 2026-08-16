import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const baseUrl = process.env.VIEW2CONNECT_AUTH_VERIFY_URL ?? 'http://127.0.0.1:8097';
const outputDir = path.resolve('test-artifacts');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

await fs.mkdir(outputDir, { recursive: true });

async function requireCount(locator, expected, label) {
  const count = await locator.count();

  if (count !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${count}.`);
  }
}

async function verifyViewport(name, viewport, isMobile, colorScheme = 'light') {
  const page = await browser.newPage({ colorScheme, isMobile, viewport });
  if (colorScheme === 'dark') {
    await page.addInitScript(() => {
      window.localStorage.setItem('urbanconnect.localTest.themeMode', JSON.stringify('dark'));
    });
  }
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(baseUrl, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
  const openSignIn = page.getByRole('button', { exact: true, name: 'Open sign in' });
  await openSignIn.waitFor({ state: 'visible', timeout: 60_000 });
  await openSignIn.click();

  const customerChoice = page.getByText('Customer', { exact: true });
  await requireCount(customerChoice, 1, `${name} customer account choice`);
  await customerChoice.click();

  const emailInput = page.getByPlaceholder('email@example.com', { exact: true });
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
  const passwordInput = page.getByPlaceholder('Enter your password', { exact: true });
  const showLoginPassword = page.getByRole('button', { exact: true, name: 'Show password' });
  await requireCount(showLoginPassword, 1, `${name} login password toggle`);
  await showLoginPassword.click();
  await requireCount(
    page.getByRole('button', { exact: true, name: 'Hide password' }),
    1,
    `${name} visible login password toggle`,
  );
  await requireCount(
    page.getByText('Forgot password?', { exact: true }),
    1,
    `${name} forgot-password action`,
  );

  const phoneMode = page.getByText('Phone', { exact: true });
  await requireCount(phoneMode, 1, `${name} phone mode`);
  await phoneMode.click();
  const nigeriaPhoneInput = page.getByPlaceholder('8012345678', { exact: true });
  await nigeriaPhoneInput.waitFor({ state: 'visible' });
  await nigeriaPhoneInput.fill('8012345678');
  const defaultNigeriaCode = await page.getByText(/NG \+234/).count();

  const emailMode = page.getByText('Email', { exact: true });
  await requireCount(emailMode, 1, `${name} email mode`);
  await emailMode.click();
  await emailInput.waitFor({ state: 'visible' });

  await page.screenshot({
    fullPage: false,
    path: path.join(outputDir, `auth-login-${name}.png`),
  });

  const createAccount = page.getByRole('button', {
    exact: true,
    name: isMobile ? 'Create account' : 'Create user account',
  });
  await requireCount(createAccount, 1, `${name} create-account action`);
  await createAccount.click();

  await page
    .getByText(isMobile ? 'Create your account' : 'Create your user account.', { exact: true })
    .waitFor({ state: 'visible', timeout: 30_000 });
  const signupPlaceholders = isMobile
    ? ['First name', 'Last name', '8012345678', 'email@example.com', 'Password', 'Repeat']
    : ['Maya', 'Johnson', '8012345678', 'Email address', 'Password', 'Repeat'];

  for (const placeholder of signupPlaceholders) {
    await page.getByPlaceholder(placeholder, { exact: true }).waitFor({ state: 'visible' });
  }

  if (isMobile) {
    await requireCount(page.getByRole('button', { exact: true, name: 'Show password' }), 1, `${name} signup password toggle`);
    await requireCount(page.getByRole('button', { exact: true, name: 'Show password confirmation' }), 1, `${name} signup password confirmation toggle`);
  } else {
    await requireCount(page.getByRole('button', { exact: true, name: 'Show password' }), 2, `${name} signup password toggles`);
  }
  await requireCount(
    page.getByRole('button', { exact: true, name: 'Send verification code' }),
    1,
    `${name} verification-code action`,
  );
  await page.screenshot({
    fullPage: false,
    path: path.join(outputDir, `auth-signup-${name}.png`),
  });

  const layout = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    noVerticalOverflow: document.documentElement.scrollHeight <= window.innerHeight + 1,
    viewportWidth: window.innerWidth,
  }));
  const desktopVisualCount = await page
    .getByText('Buy. Sell. Deliver. Connect locally.', { exact: true })
    .count();
  const mobileVisualCount = await page.getByText('Create your account', { exact: true }).count();

  await page.getByPlaceholder(isMobile ? 'First name' : 'Maya', { exact: true }).focus();
  await page.setViewportSize({ width: viewport.width, height: Math.max(360, viewport.height - 280) });
  const keyboardLayout = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    focusedElementVisible: (() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    })(),
  }));

  await page.close();

  return {
    consoleErrors,
    defaultNigeriaCodeVisible: defaultNigeriaCode >= 1,
    layout,
    keyboardLayout,
    pageErrors,
    status: response?.status() ?? null,
    usesExpectedPresentation: isMobile ? mobileVisualCount === 1 : desktopVisualCount === 1,
  };
}

try {
  const results = {
    desktop: await verifyViewport('desktop', { width: 1440, height: 1000 }, false),
    narrowMobile: await verifyViewport('narrow-mobile', { width: 320, height: 568 }, true),
    standardMobile: await verifyViewport('standard-mobile', { width: 360, height: 800 }, true),
    mobile: await verifyViewport('mobile', { width: 390, height: 844 }, true),
    largeMobile: await verifyViewport('large-mobile', { width: 430, height: 932 }, true),
    darkMobile: await verifyViewport('dark-mobile', { width: 390, height: 844 }, true, 'dark'),
  };

  console.log(JSON.stringify(results, null, 2));

  if (
    Object.values(results).some(
      (result) =>
        result.status !== 200 ||
        !result.defaultNigeriaCodeVisible ||
        !result.layout.noHorizontalOverflow ||
        !result.keyboardLayout.noHorizontalOverflow ||
        !result.keyboardLayout.focusedElementVisible ||
        !result.usesExpectedPresentation ||
        result.consoleErrors.length > 0 ||
        result.pageErrors.length > 0,
    )
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
