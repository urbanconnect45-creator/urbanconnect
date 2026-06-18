import fs from 'node:fs/promises';
import path from 'node:path';

const adminPath = 'admin-portal';

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect</title>
  <desc id="desc">UrbanConnect UC location mark</desc>
  <rect width="160" height="160" rx="34" fill="#12372A"/>
  <path d="M35 105c17-17 33-25 48-25s29 8 42 25" fill="none" stroke="#F2B84B" stroke-width="16" stroke-linecap="round"/>
  <text x="35" y="82" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="900" fill="#FFFFFF">UC</text>
  <path d="M116 33c-13 0-24 11-24 24 0 18 24 43 24 43s24-25 24-43c0-13-11-24-24-24zm0 34a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" fill="#EF6A4E"/>
</svg>`;

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildLandingHtml() {
  const appStoreUrl = process.env.URBANCONNECT_APP_STORE_URL?.trim() || '#app-store';
  const playStoreUrl = process.env.URBANCONNECT_PLAY_STORE_URL?.trim() || '#play-store';
  const siteUrl = process.env.URBANCONNECT_SITE_URL?.trim() || 'https://urbanconnectstore.com';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#12372A" />
    <meta
      name="description"
      content="UrbanConnect is the River Park marketplace app for approved products, services, support, payments, and delivery updates."
    />
    <title>UrbanConnect | River Park Marketplace App</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #12201b;
        --muted: #607168;
        --paper: #f6f8f4;
        --card: #ffffff;
        --line: #dbe3dd;
        --primary: #12372a;
        --primary-soft: #dcebe3;
        --accent: #ef6a4e;
        --gold: #f2b84b;
        --blue: #2f6f9f;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--paper);
        color: var(--ink);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        letter-spacing: 0;
      }

      a {
        color: inherit;
      }

      .page {
        min-height: 100vh;
        overflow-x: hidden;
      }

      .shell {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 22px 0;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
      }

      .brand img {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        box-shadow: 0 14px 28px rgba(18, 55, 42, 0.18);
      }

      .brand strong {
        display: block;
        font-size: 18px;
        line-height: 22px;
        font-weight: 900;
      }

      .brand span {
        display: block;
        color: var(--muted);
        font-size: 13px;
        line-height: 18px;
        font-weight: 700;
      }

      .nav-copy {
        color: var(--muted);
        font-size: 14px;
        line-height: 20px;
        font-weight: 800;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.04fr) minmax(320px, 0.96fr);
        align-items: center;
        gap: 44px;
        padding: 58px 0 44px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        width: max-content;
        max-width: 100%;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--card);
        color: var(--primary);
        padding: 8px 12px;
        font-size: 13px;
        line-height: 18px;
        font-weight: 900;
      }

      .eyebrow::before {
        content: "";
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent);
      }

      h1 {
        margin: 18px 0 14px;
        max-width: 760px;
        font-size: clamp(42px, 6vw, 78px);
        line-height: 0.98;
        font-weight: 950;
        letter-spacing: 0;
      }

      .lead {
        max-width: 620px;
        margin: 0;
        color: #34443d;
        font-size: 19px;
        line-height: 31px;
        font-weight: 650;
      }

      .store-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      .store-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 54px;
        border-radius: 8px;
        border: 1px solid transparent;
        padding: 0 18px;
        text-decoration: none;
        font-size: 15px;
        line-height: 20px;
        font-weight: 900;
      }

      .store-button.primary {
        background: var(--primary);
        color: #fff;
      }

      .store-button.secondary {
        background: #fff;
        border-color: var(--line);
        color: var(--ink);
      }

      .store-icon {
        display: inline-grid;
        place-items: center;
        width: 25px;
        height: 25px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.16);
        font-size: 14px;
        font-weight: 950;
      }

      .store-button.secondary .store-icon {
        background: var(--primary-soft);
        color: var(--primary);
      }

      .note {
        margin-top: 18px;
        color: var(--muted);
        font-size: 13px;
        line-height: 19px;
        font-weight: 750;
      }

      .phone-scene {
        position: relative;
        min-height: 550px;
        display: grid;
        place-items: center;
      }

      .phone {
        width: min(340px, 88vw);
        border: 10px solid #16261f;
        border-radius: 34px;
        background: #f9fbf7;
        box-shadow: 0 28px 70px rgba(18, 32, 27, 0.24);
        overflow: hidden;
      }

      .phone-top {
        height: 42px;
        background: #16261f;
        display: grid;
        place-items: center;
      }

      .speaker {
        width: 78px;
        height: 7px;
        border-radius: 999px;
        background: #33483f;
      }

      .phone-body {
        padding: 18px;
      }

      .app-hero {
        border-radius: 18px;
        background: var(--primary);
        color: #fff;
        padding: 20px;
      }

      .app-hero small {
        color: #cfe3d9;
        font-size: 12px;
        font-weight: 850;
      }

      .app-hero strong {
        display: block;
        margin-top: 8px;
        font-size: 25px;
        line-height: 30px;
        font-weight: 950;
      }

      .product-row {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 14px;
      }

      .mini-card {
        min-height: 126px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 12px;
      }

      .swatch {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        margin-bottom: 12px;
      }

      .swatch.orange {
        background: var(--accent);
      }

      .swatch.blue {
        background: var(--blue);
      }

      .mini-card strong {
        display: block;
        font-size: 13px;
        line-height: 18px;
        font-weight: 900;
      }

      .mini-card span {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 12px;
        line-height: 17px;
        font-weight: 750;
      }

      .status-strip {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
        border-radius: 8px;
        background: #fff4df;
        padding: 12px;
      }

      .status-strip strong {
        font-size: 13px;
        line-height: 18px;
        font-weight: 950;
      }

      .status-strip span {
        color: #7d5a12;
        font-size: 12px;
        font-weight: 850;
      }

      .sections {
        padding: 20px 0 54px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }

      .info {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
        padding: 20px;
      }

      .info strong {
        display: block;
        font-size: 17px;
        line-height: 23px;
        font-weight: 950;
      }

      .info p {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 22px;
        font-weight: 650;
      }

      footer {
        border-top: 1px solid var(--line);
        padding: 24px 0 34px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 750;
      }

      @media (max-width: 860px) {
        .nav {
          align-items: flex-start;
          flex-direction: column;
        }

        .hero {
          grid-template-columns: 1fr;
          padding-top: 30px;
        }

        .phone-scene {
          min-height: 0;
        }

        .info-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 520px) {
        .shell {
          width: min(100% - 24px, 1120px);
        }

        h1 {
          font-size: 40px;
          line-height: 1.02;
        }

        .lead {
          font-size: 17px;
          line-height: 28px;
        }

        .store-button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="shell">
        <nav class="nav" aria-label="UrbanConnect">
          <a class="brand" href="${escapeHtml(siteUrl)}">
            <img src="/assets/urbanconnect-mark.svg" alt="UrbanConnect logo" />
            <span>
              <strong>UrbanConnect</strong>
              <span>River Park marketplace</span>
            </span>
          </a>
          <div class="nav-copy">Mobile app only. Web is for download and support information.</div>
        </nav>

        <section class="hero" aria-labelledby="hero-title">
          <div>
            <div class="eyebrow">Built for River Park residents and business owners</div>
            <h1 id="hero-title">Shop, pay, verify, and get support from the UrbanConnect mobile app.</h1>
            <p class="lead">
              UrbanConnect keeps local buying focused: approved listings, wallet and Flutterwave payments,
              customer care support, order receipts, and delivery updates from one mobile app.
            </p>
            <div class="store-row" id="download">
              <a class="store-button primary" href="${escapeHtml(appStoreUrl)}" id="app-store">
                <span class="store-icon">A</span>
                App Store
              </a>
              <a class="store-button secondary" href="${escapeHtml(playStoreUrl)}" id="play-store">
                <span class="store-icon">P</span>
                Google Play
              </a>
            </div>
            <p class="note">
              The customer app is not available on mobile web. Install the iOS or Android app when the store listings are live.
            </p>
          </div>

          <div class="phone-scene" aria-hidden="true">
            <div class="phone">
              <div class="phone-top"><div class="speaker"></div></div>
              <div class="phone-body">
                <div class="app-hero">
                  <small>UrbanConnect wallet</small>
                  <strong>Payment confirmed after provider verification.</strong>
                </div>
                <div class="product-row">
                  <div class="mini-card">
                    <div class="swatch orange"></div>
                    <strong>Approved products</strong>
                    <span>Local listings reviewed before customers buy.</span>
                  </div>
                  <div class="mini-card">
                    <div class="swatch blue"></div>
                    <strong>Customer care</strong>
                    <span>Support for orders, payments, and verification.</span>
                  </div>
                </div>
                <div class="status-strip">
                  <strong>Receipt ready</strong>
                  <span>Email sent</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="sections" aria-label="About UrbanConnect">
          <div class="info-grid">
            <article class="info">
              <strong>About us</strong>
              <p>UrbanConnect helps River Park residents discover trusted local sellers and services without leaving the estate workflow.</p>
            </article>
            <article class="info">
              <strong>Secure payments</strong>
              <p>Wallet, card, and bank payments are tracked through provider-confirmed transaction status before receipts are issued.</p>
            </article>
            <article class="info">
              <strong>Admin protected</strong>
              <p>The operations dashboard is separate from this public website and is available only through a private desktop link.</p>
            </article>
          </div>
        </section>

        <footer>
          UrbanConnect for River Park. Public website for app downloads only.
        </footer>
      </div>
    </main>
  </body>
</html>`;
}

export async function prepareWebOutput(rootDir) {
  const distDir = path.join(rootDir, 'dist');
  const indexPath = path.join(distDir, 'index.html');
  const expoIndex = await fs.readFile(indexPath, 'utf8');
  const adminDir = path.join(distDir, adminPath);
  const assetsDir = path.join(distDir, 'assets');

  await fs.mkdir(adminDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(adminDir, 'index.html'), expoIndex.replace('<title>UrbanConnect</title>', '<title>UrbanConnect Admin</title>'));
  await fs.writeFile(path.join(assetsDir, 'urbanconnect-mark.svg'), logoSvg);
  await fs.writeFile(indexPath, buildLandingHtml());
}
