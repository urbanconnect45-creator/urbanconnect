import fs from 'node:fs/promises';
import path from 'node:path';

const adminPath = 'admin-portal';
const appPath = 'app';
const defaultSiteUrl = 'https://urbanconnectstore.com';
const siteName = 'UrbanConnect';
const siteDescription =
  'UrbanConnect is the River Park marketplace app for approved products, services, support, payments, receipts, and delivery updates.';
const supportEmail = 'support@urbanconnectstore.com';
const heroCarouselImages = [
  {
    src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=85',
    alt: 'Customer shopping online with a card and phone',
    dotLabel: 'Show online shopping slide',
  },
  {
    src: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=1800&q=85',
    alt: 'Ecommerce shopping cart and product delivery concept',
    dotLabel: 'Show marketplace delivery slide',
  },
  {
    src: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1800&q=85',
    alt: 'Mobile payment and customer support for online orders',
    dotLabel: 'Show payment and support slide',
  },
];

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect</title>
  <desc id="desc">UrbanConnect UC location mark</desc>
  <rect width="160" height="160" rx="34" fill="#12372A"/>
  <path d="M35 105c17-17 33-25 48-25s29 8 42 25" fill="none" stroke="#F2B84B" stroke-width="16" stroke-linecap="round"/>
  <text x="35" y="82" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="900" fill="#FFFFFF">UC</text>
  <path d="M116 33c-13 0-24 11-24 24 0 18 24 43 24 43s24-25 24-43c0-13-11-24-24-24zm0 34a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" fill="#EF6A4E"/>
</svg>`;

const assetMap = {
  'urbanconnect-carousel-market.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 760" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect marketplace hero</title>
  <desc id="desc">A bright marketplace scene with local shopping, wallet status, and support cards.</desc>
  <rect width="1440" height="760" fill="#EAF3EE"/>
  <rect x="74" y="74" width="1292" height="612" rx="42" fill="#12372A"/>
  <rect x="124" y="128" width="426" height="504" rx="30" fill="#FFFFFF"/>
  <rect x="164" y="168" width="346" height="90" rx="18" fill="#DCEBE3"/>
  <text x="194" y="210" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="#12372A">River Park shop</text>
  <text x="194" y="244" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#607168">Approved listings near you</text>
  <rect x="164" y="300" width="150" height="150" rx="22" fill="#EF6A4E"/>
  <rect x="360" y="300" width="150" height="150" rx="22" fill="#2F6F9F"/>
  <rect x="164" y="486" width="346" height="82" rx="18" fill="#FFF4DF"/>
  <text x="194" y="534" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#12372A">Receipt ready</text>
  <circle cx="850" cy="226" r="92" fill="#F2B84B"/>
  <rect x="720" y="354" width="458" height="170" rx="30" fill="#FFFFFF"/>
  <text x="772" y="420" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="950" fill="#12372A">Shop, pay, track.</text>
  <text x="772" y="462" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#607168">One mobile flow for residents and business owners.</text>
  <path d="M772 560h328" stroke="#F2B84B" stroke-width="20" stroke-linecap="round"/>
  <path d="M772 608h220" stroke="#EF6A4E" stroke-width="20" stroke-linecap="round"/>
</svg>`,
  'urbanconnect-carousel-wallet.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 760" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect payment hero</title>
  <desc id="desc">Wallet, card payment, bank transfer, and confirmed receipt cards.</desc>
  <rect width="1440" height="760" fill="#F4F7FA"/>
  <rect x="88" y="88" width="1264" height="584" rx="44" fill="#FFFFFF"/>
  <rect x="148" y="148" width="500" height="464" rx="34" fill="#12372A"/>
  <text x="204" y="226" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#CFE3D9">UrbanConnect wallet</text>
  <text x="204" y="318" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="950" fill="#FFFFFF">Confirmed</text>
  <rect x="204" y="386" width="350" height="82" rx="20" fill="#F2B84B"/>
  <text x="240" y="438" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="950" fill="#12372A">Provider verified</text>
  <rect x="762" y="154" width="356" height="190" rx="32" fill="#EF6A4E"/>
  <rect x="826" y="216" width="230" height="22" rx="11" fill="#FFFFFF" opacity=".86"/>
  <rect x="826" y="266" width="150" height="22" rx="11" fill="#FFFFFF" opacity=".56"/>
  <rect x="824" y="408" width="356" height="190" rx="32" fill="#2F6F9F"/>
  <circle cx="902" cy="502" r="40" fill="#FFFFFF" opacity=".9"/>
  <rect x="982" y="470" width="136" height="24" rx="12" fill="#FFFFFF" opacity=".86"/>
  <rect x="982" y="520" width="100" height="24" rx="12" fill="#FFFFFF" opacity=".56"/>
</svg>`,
  'urbanconnect-carousel-support.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 760" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect support hero</title>
  <desc id="desc">Customer care, admin operations, support messages, and verification workflow.</desc>
  <rect width="1440" height="760" fill="#F8F6F1"/>
  <rect x="86" y="80" width="1268" height="600" rx="44" fill="#12372A"/>
  <rect x="148" y="142" width="430" height="476" rx="32" fill="#FFFFFF"/>
  <text x="202" y="220" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="950" fill="#12372A">Customer care</text>
  <rect x="202" y="278" width="300" height="58" rx="18" fill="#DCEBE3"/>
  <rect x="202" y="374" width="220" height="58" rx="18" fill="#FFF4DF"/>
  <rect x="202" y="470" width="324" height="58" rx="18" fill="#DDE9F2"/>
  <circle cx="868" cy="230" r="110" fill="#F2B84B"/>
  <rect x="750" y="396" width="412" height="142" rx="30" fill="#FFFFFF"/>
  <text x="812" y="456" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="950" fill="#12372A">Verified help</text>
  <text x="812" y="500" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#607168">Orders, payments, and IDs stay organized.</text>
  <path d="M802 592h300" stroke="#EF6A4E" stroke-width="22" stroke-linecap="round"/>
</svg>`,
  'urbanconnect-screenshot-shop.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 860" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect app shopping screenshot</title>
  <desc id="desc">Mobile app screen showing River Park shop listings.</desc>
  <rect width="520" height="860" rx="44" fill="#16261F"/>
  <rect x="24" y="28" width="472" height="804" rx="34" fill="#F6F8F4"/>
  <rect x="54" y="62" width="412" height="126" rx="24" fill="#12372A"/>
  <text x="86" y="120" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="950" fill="#FFFFFF">River Park shop</text>
  <text x="86" y="154" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#CFE3D9">Products approved by customer care</text>
  <rect x="54" y="224" width="190" height="210" rx="18" fill="#FFFFFF"/>
  <rect x="276" y="224" width="190" height="210" rx="18" fill="#FFFFFF"/>
  <rect x="78" y="248" width="142" height="92" rx="18" fill="#EF6A4E"/>
  <rect x="300" y="248" width="142" height="92" rx="18" fill="#2F6F9F"/>
  <text x="78" y="376" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#12372A">Fresh basket</text>
  <text x="300" y="376" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#12372A">Home service</text>
  <rect x="54" y="474" width="412" height="92" rx="18" fill="#FFFFFF"/>
  <text x="88" y="526" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#12372A">Track orders</text>
  <rect x="54" y="602" width="412" height="128" rx="22" fill="#FFF4DF"/>
  <text x="88" y="662" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="950" fill="#12372A">Receipt emailed</text>
</svg>`,
  'urbanconnect-screenshot-wallet.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 860" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect wallet screenshot</title>
  <desc id="desc">Mobile app screen showing wallet balance and add funds with Flutterwave.</desc>
  <rect width="520" height="860" rx="44" fill="#16261F"/>
  <rect x="24" y="28" width="472" height="804" rx="34" fill="#F4F7FA"/>
  <rect x="54" y="68" width="412" height="196" rx="28" fill="#12372A"/>
  <text x="86" y="132" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#CFE3D9">Portfolio balance</text>
  <text x="86" y="206" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="950" fill="#FFFFFF">NGN 25,000</text>
  <rect x="54" y="306" width="190" height="100" rx="20" fill="#EF6A4E"/>
  <text x="90" y="366" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="950" fill="#FFFFFF">Card</text>
  <rect x="276" y="306" width="190" height="100" rx="20" fill="#2F6F9F"/>
  <text x="312" y="366" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="950" fill="#FFFFFF">Bank</text>
  <rect x="54" y="452" width="412" height="120" rx="22" fill="#FFFFFF"/>
  <text x="88" y="512" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="950" fill="#12372A">Provider confirmed</text>
  <text x="88" y="548" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#607168">Wallet credits after Flutterwave confirms.</text>
  <rect x="54" y="616" width="412" height="112" rx="22" fill="#FFFFFF"/>
  <text x="88" y="680" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#12372A">All transactions</text>
</svg>`,
  'urbanconnect-screenshot-support.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 860" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect support screenshot</title>
  <desc id="desc">Mobile app screen showing customer care support messages.</desc>
  <rect width="520" height="860" rx="44" fill="#16261F"/>
  <rect x="24" y="28" width="472" height="804" rx="34" fill="#F8F6F1"/>
  <rect x="54" y="68" width="412" height="126" rx="28" fill="#12372A"/>
  <text x="86" y="128" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="950" fill="#FFFFFF">Customer care</text>
  <text x="86" y="162" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#CFE3D9">Order and payment support</text>
  <rect x="54" y="246" width="300" height="88" rx="22" fill="#FFFFFF"/>
  <text x="82" y="298" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#12372A">How can we help?</text>
  <rect x="166" y="374" width="300" height="88" rx="22" fill="#DCEBE3"/>
  <text x="196" y="426" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900" fill="#12372A">I need my receipt</text>
  <rect x="54" y="506" width="330" height="112" rx="22" fill="#FFFFFF"/>
  <text x="82" y="564" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#12372A">Receipt sent to email</text>
  <rect x="54" y="670" width="412" height="56" rx="28" fill="#FFFFFF"/>
</svg>`,
};

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeBaseUrl(value) {
  const trimmed = value?.trim() || defaultSiteUrl;
  return trimmed.replace(/\/+$/, '') || defaultSiteUrl;
}

function jsonLdScript(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function buildHeader(activePath) {
  return `<header class="site-header">
    <a class="brand" href="/">
      <img src="/assets/urbanconnect-mark.svg" alt="UrbanConnect logo" />
      <span>
        <strong>UrbanConnect</strong>
        <span>River Park marketplace</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Main navigation">
      ${navLinks
        .map(
          (link) =>
            `<a class="${link.href === activePath ? 'active' : ''}" href="${link.href}">${link.label}</a>`,
        )
        .join('')}
    </nav>
    <button class="nav-cta" type="button" data-store-button="UrbanConnect app">Get the app</button>
  </header>`;
}

function buildFooter() {
  const year = new Date().getUTCFullYear();

  return `<footer class="footer" id="contact">
    <div>
      <strong>UrbanConnect</strong>
      <p>River Park marketplace for approved local shopping, payments, receipts, and customer care.</p>
    </div>
    <div class="footer-links">
      <a href="mailto:${supportEmail}">${supportEmail}</a>
      <a href="/contact/">Contact</a>
      <a href="/about/">About</a>
    </div>
    <div class="copyright">Copyright ${year} UrbanConnect. All rights reserved.</div>
  </footer>`;
}

function buildSharedHead({
  canonicalPath,
  description,
  robots = 'index,follow,max-image-preview:large',
  title,
}) {
  const siteUrl = normalizeBaseUrl(process.env.URBANCONNECT_SITE_URL);
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const previewImageUrl = heroCarouselImages[0].src;
  const organizationJson = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/assets/urbanconnect-mark.svg`,
    email: supportEmail,
    description: siteDescription,
  };
  const websiteJson = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    description: siteDescription,
  };
  const appJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteName,
    applicationCategory: 'ShoppingApplication',
    operatingSystem: 'iOS, Android',
    description: siteDescription,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'NGN',
    },
  };

  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#12372A" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="preconnect" href="https://images.unsplash.com" />
    <link rel="icon" type="image/svg+xml" href="/assets/urbanconnect-mark.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(previewImageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(previewImageUrl)}" />
    <script type="application/ld+json">${jsonLdScript(organizationJson)}</script>
    <script type="application/ld+json">${jsonLdScript(websiteJson)}</script>
    <script type="application/ld+json">${jsonLdScript(appJson)}</script>
    <title>${escapeHtml(title)}</title>`;
}

function buildStyles() {
  return `<style>
      :root {
        color-scheme: light;
        --ink: #12201b;
        --muted: #607168;
        --paper: #f5f7f1;
        --card: #ffffff;
        --line: #dbe3dd;
        --primary: #12372a;
        --primary-soft: #dcebe3;
        --accent: #ef6a4e;
        --gold: #f2b84b;
        --blue: #2f6f9f;
      }

      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        min-height: 100vh;
        background: var(--paper);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }
      a, button { color: inherit; font: inherit; }
      button { cursor: pointer; }
      img { max-width: 100%; }
      .page { min-height: 100vh; overflow-x: hidden; }
      .shell { width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
      .site-header {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        width: min(1180px, calc(100% - 28px));
        margin: 14px auto 0;
        border: 1px solid rgba(219, 227, 221, 0.86);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        padding: 12px;
        box-shadow: 0 18px 46px rgba(18, 32, 27, 0.12);
        backdrop-filter: blur(16px);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        min-width: max-content;
      }
      .brand img {
        width: 44px;
        height: 44px;
        border-radius: 8px;
      }
      .brand strong {
        display: block;
        font-size: 18px;
        line-height: 22px;
        font-weight: 950;
      }
      .brand span span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        line-height: 17px;
        font-weight: 800;
      }
      .site-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .site-nav a {
        border-radius: 999px;
        padding: 9px 13px;
        text-decoration: none;
        color: var(--muted);
        font-size: 14px;
        line-height: 18px;
        font-weight: 900;
      }
      .site-nav a.active,
      .site-nav a:hover {
        background: var(--primary-soft);
        color: var(--primary);
      }
      .nav-cta, .store-button, .primary-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        border: 0;
        border-radius: 8px;
        background: var(--primary);
        color: #fff;
        padding: 0 18px;
        text-decoration: none;
        font-size: 14px;
        line-height: 18px;
        font-weight: 950;
      }
      .nav-cta { min-width: 124px; }
      .primary-link.ghost {
        border: 1px solid var(--border);
        background: #fff;
        color: var(--primary);
      }
      .hero {
        position: relative;
        min-height: min(720px, calc(100vh - 34px));
        display: grid;
        align-items: end;
        margin-top: -72px;
        overflow: hidden;
        background: var(--primary);
      }
      .hero-slide {
        position: absolute;
        inset: 0;
        opacity: 0;
        transition: opacity 560ms ease;
      }
      .hero-slide.is-active { opacity: 1; }
      .hero-slide img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .hero::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(8, 23, 18, 0.84), rgba(8, 23, 18, 0.44) 48%, rgba(8, 23, 18, 0.16));
      }
      .hero-content {
        position: relative;
        z-index: 2;
        width: min(1160px, calc(100% - 32px));
        margin: 0 auto;
        padding: 150px 0 64px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        color: #f7efe1;
        padding: 8px 12px;
        font-size: 13px;
        line-height: 18px;
        font-weight: 950;
      }
      .eyebrow::before {
        content: "";
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent);
      }
      h1 {
        margin: 18px 0 16px;
        max-width: 780px;
        color: #fff;
        font-size: 74px;
        line-height: 0.98;
        font-weight: 950;
        letter-spacing: 0;
      }
      .hero-lead {
        max-width: 700px;
        margin: 0;
        color: #dcebe3;
        font-size: 20px;
        line-height: 32px;
        font-weight: 750;
      }
      .store-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }
      .store-button.secondary {
        background: #fff;
        color: var(--primary);
      }
      .store-button.web-link {
        background: var(--gold);
        color: var(--primary);
      }
      .hero-dots {
        display: flex;
        gap: 8px;
        margin-top: 34px;
      }
      .hero-dot {
        width: 34px;
        height: 10px;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.38);
      }
      .hero-dot.is-active { background: var(--gold); }
      .section {
        padding: 70px 0;
      }
      .section.tight { padding-top: 34px; }
      .section-header {
        display: grid;
        grid-template-columns: minmax(0, 0.86fr) minmax(300px, 1.14fr);
        gap: 28px;
        align-items: end;
        margin-bottom: 24px;
      }
      .section-kicker {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 13px;
        line-height: 18px;
        font-weight: 950;
        text-transform: uppercase;
      }
      h2 {
        margin: 0;
        color: var(--ink);
        font-size: 42px;
        line-height: 1.05;
        font-weight: 950;
        letter-spacing: 0;
      }
      .section-copy {
        margin: 0;
        color: var(--muted);
        font-size: 17px;
        line-height: 28px;
        font-weight: 700;
      }
      .feature-grid, .steps-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      .card, .feature-card, .contact-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
        padding: 22px;
        box-shadow: 0 18px 44px rgba(18, 32, 27, 0.08);
      }
      .feature-card {
        min-height: 190px;
      }
      .feature-icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 8px;
        margin-bottom: 18px;
        background: var(--primary-soft);
        color: var(--primary);
        font-size: 20px;
        font-weight: 950;
      }
      .feature-card strong,
      .card strong,
      .contact-card strong {
        display: block;
        color: var(--ink);
        font-size: 19px;
        line-height: 25px;
        font-weight: 950;
      }
      .feature-card p,
      .card p,
      .contact-card p {
        margin: 9px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 23px;
        font-weight: 700;
      }
      .screen-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
        align-items: start;
      }
      .screen-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 16px;
        box-shadow: 0 24px 58px rgba(18, 32, 27, 0.11);
      }
      .screen-card img {
        width: 100%;
        border-radius: 8px;
        display: block;
        background: #e8efe9;
      }
      .screen-caption {
        padding: 16px 4px 4px;
      }
      .band {
        background: #ffffff;
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }
      .contact-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.78fr);
        gap: 18px;
      }
      .contact-list {
        display: grid;
        gap: 10px;
        margin-top: 18px;
      }
      .contact-list a,
      .contact-list span {
        display: flex;
        align-items: center;
        min-height: 46px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 0 14px;
        text-decoration: none;
        color: var(--primary);
        font-weight: 900;
      }
      .footer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        width: min(1160px, calc(100% - 32px));
        margin: 0 auto;
        border-top: 1px solid var(--line);
        padding: 30px 0 38px;
        color: var(--muted);
      }
      .footer strong { color: var(--ink); font-size: 18px; font-weight: 950; }
      .footer p { max-width: 520px; margin: 8px 0 0; line-height: 23px; font-weight: 700; }
      .footer-links {
        display: flex;
        align-items: start;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: flex-end;
      }
      .footer-links a {
        color: var(--primary);
        text-decoration: none;
        font-weight: 900;
      }
      .copyright {
        grid-column: 1 / -1;
        font-size: 13px;
        font-weight: 800;
      }
      .launch-modal {
        position: fixed;
        inset: 0;
        z-index: 30;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(18, 32, 27, 0.62);
      }
      .launch-dialog {
        width: min(440px, 100%);
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 22px;
        box-shadow: 0 24px 68px rgba(18, 32, 27, 0.24);
      }
      .launch-dialog strong {
        display: block;
        font-size: 22px;
        line-height: 28px;
        font-weight: 950;
      }
      .launch-dialog p {
        margin: 10px 0 18px;
        color: var(--muted);
        font-size: 15px;
        line-height: 23px;
        font-weight: 700;
      }
      .launch-dialog button {
        min-height: 44px;
        width: 100%;
        border: 0;
        border-radius: 8px;
        background: var(--primary);
        color: #fff;
        font-weight: 900;
      }
      .page-hero {
        padding: 84px 0 44px;
      }
      .page-hero h1 {
        color: var(--ink);
        max-width: 860px;
      }
      .page-hero .hero-lead {
        color: var(--muted);
      }

      @media (max-width: 920px) {
        .site-header {
          align-items: flex-start;
          flex-direction: column;
        }
        .site-nav {
          justify-content: flex-start;
        }
        .nav-cta {
          width: 100%;
        }
        .hero {
          margin-top: -142px;
          min-height: 760px;
        }
        .hero-content {
          padding-top: 220px;
        }
        h1 {
          font-size: 54px;
        }
        .section-header,
        .feature-grid,
        .steps-grid,
        .screen-grid,
        .contact-grid,
        .footer {
          grid-template-columns: 1fr;
        }
        .footer-links {
          justify-content: flex-start;
        }
      }

      @media (max-width: 560px) {
        .shell,
        .hero-content,
        .footer {
          width: min(100% - 24px, 1160px);
        }
        .brand span span {
          display: none;
        }
        .site-nav a {
          padding: 8px 10px;
          font-size: 13px;
        }
        h1 {
          font-size: 42px;
          line-height: 1.03;
        }
        h2 {
          font-size: 32px;
        }
        .hero-lead,
        .section-copy {
          font-size: 16px;
          line-height: 26px;
        }
        .store-button {
          width: 100%;
        }
      }
    </style>`;
}

function buildLaunchModal() {
  const launchMessage =
    'UrbanConnect is still in review. App Store and Google Play launch soon.';

  return `<div class="launch-modal" data-launch-modal hidden>
      <div class="launch-dialog" role="dialog" aria-modal="true" aria-labelledby="launch-title">
        <strong id="launch-title">Store launch coming soon</strong>
        <p data-launch-message>${escapeHtml(launchMessage)}</p>
        <button type="button" data-launch-close>Close</button>
      </div>
    </div>
    <script>
      (() => {
        const modal = document.querySelector('[data-launch-modal]');
        const message = modal?.querySelector('[data-launch-message]');
        const launchMessage = '${escapeHtml(launchMessage)}';
        const slides = Array.from(document.querySelectorAll('[data-hero-slide]'));
        const dots = Array.from(document.querySelectorAll('[data-hero-dot]'));
        let activeSlide = 0;

        const showSlide = (index) => {
          if (!slides.length) return;
          activeSlide = (index + slides.length) % slides.length;
          slides.forEach((slide, slideIndex) => {
            slide.classList.toggle('is-active', slideIndex === activeSlide);
          });
          dots.forEach((dot) => {
            dot.classList.toggle('is-active', Number(dot.dataset.heroDot) === activeSlide);
          });
        };

        dots.forEach((dot) => {
          dot.addEventListener('click', () => showSlide(Number(dot.dataset.heroDot)));
        });

        if (slides.length > 1) {
          window.setInterval(() => showSlide(activeSlide + 1), 5200);
        }

        const closeModal = () => modal?.setAttribute('hidden', '');
        document.querySelectorAll('[data-store-button]').forEach((button) => {
          button.addEventListener('click', () => {
            const storeName = button.getAttribute('data-store-button') || 'this store';
            if (message) {
              message.textContent = storeName + ': ' + launchMessage;
            }
            modal?.removeAttribute('hidden');
          });
        });
        document.querySelectorAll('[data-launch-close]').forEach((button) => {
          button.addEventListener('click', closeModal);
        });
        modal?.addEventListener('click', (event) => {
          if (event.target === modal) closeModal();
        });
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') closeModal();
        });
      })();
    </script>`;
}

function buildDocument({
  activePath,
  body,
  canonicalPath,
  description,
  robots,
  title,
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    ${buildSharedHead({ canonicalPath, description, robots, title })}
    ${buildStyles()}
  </head>
  <body>
    <main class="page">
      ${buildHeader(activePath)}
      ${body}
      ${buildFooter()}
    </main>
    ${buildLaunchModal()}
  </body>
</html>`;
}

function buildHomeHtml() {
  const body = `<section class="hero" aria-labelledby="hero-title">
      ${heroCarouselImages
        .map(
          (image, index) => `<div class="hero-slide${index === 0 ? ' is-active' : ''}" data-hero-slide>
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" ${
          index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'
        } />
      </div>`,
        )
        .join('')}
      <div class="hero-content">
        <div class="eyebrow">Built for River Park residents and business owners</div>
        <h1 id="hero-title">UrbanConnect</h1>
        <p class="hero-lead">
          A mobile-first marketplace for approved listings, wallet and Flutterwave payments,
          receipts, delivery updates, customer care, and business owner tools.
        </p>
        <div class="store-row">
          <button class="store-button" type="button" data-store-button="App Store">App Store</button>
          <button class="store-button secondary" type="button" data-store-button="Google Play">Google Play</button>
          <a class="store-button web-link" href="/${appPath}/">Web</a>
          <a class="primary-link" href="/how-it-works/">See how it works</a>
        </div>
        <div class="hero-dots" aria-label="Hero carousel controls">
          ${heroCarouselImages
            .map(
              (image, index) =>
                `<button class="hero-dot${index === 0 ? ' is-active' : ''}" type="button" aria-label="${escapeHtml(
                  image.dotLabel,
                )}" data-hero-dot="${index}"></button>`,
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section tight" id="features">
      <div class="shell">
        <div class="section-header">
          <div>
            <p class="section-kicker">Marketplace</p>
            <h2>One focused app for local buying inside River Park.</h2>
          </div>
          <p class="section-copy">
            UrbanConnect keeps public web simple and moves the real customer experience to the mobile app,
            where identity, wallet, receipts, support, and orders stay connected.
          </p>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <span class="feature-icon">01</span>
            <strong>Approved listings</strong>
            <p>Business owners submit products or services, while customer care and admin review what customers can see.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">02</span>
            <strong>Confirmed payments</strong>
            <p>Wallet, card, and bank flows are treated as complete only after provider confirmation and receipts.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">03</span>
            <strong>Customer care</strong>
            <p>Residents get one support route for order questions, payment help, receipts, verification, and delivery updates.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section band" id="screenshots">
      <div class="shell">
        <div class="section-header">
          <div>
            <p class="section-kicker">App walkthrough</p>
            <h2>Simple screens for the main customer actions.</h2>
          </div>
          <p class="section-copy">
            These app screen previews show the flow customers will use when the iOS and Android apps are live.
          </p>
        </div>
        <div class="screen-grid">
          <article class="screen-card">
            <img src="/assets/urbanconnect-screenshot-shop.svg" alt="UrbanConnect shop screen" />
            <div class="screen-caption">
              <strong>Browse River Park listings</strong>
              <p>Open the app, choose approved products or services, and view listing details before adding to cart.</p>
            </div>
          </article>
          <article class="screen-card">
            <img src="/assets/urbanconnect-screenshot-wallet.svg" alt="UrbanConnect wallet screen" />
            <div class="screen-caption">
              <strong>Add funds or pay</strong>
              <p>Use card or bank payment through Flutterwave, then wait for provider-confirmed wallet updates.</p>
            </div>
          </article>
          <article class="screen-card">
            <img src="/assets/urbanconnect-screenshot-support.svg" alt="UrbanConnect customer care screen" />
            <div class="screen-caption">
              <strong>Get customer care</strong>
              <p>Use support for orders, payments, receipts, verification, and delivery questions.</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell contact-grid">
        <div>
          <p class="section-kicker">Launch status</p>
          <h2>The mobile app is being prepared for App Store and Google Play.</h2>
          <p class="section-copy">
            The public website is here for launch information, app previews, and contact details.
            The customer app itself is not available on mobile web.
          </p>
        </div>
        <article class="contact-card">
          <strong>Contact UrbanConnect</strong>
          <p>For launch questions, store availability, support, or business owner onboarding, contact customer care.</p>
          <div class="contact-list">
            <a href="mailto:${supportEmail}">${supportEmail}</a>
            <span>River Park marketplace support</span>
          </div>
        </article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/',
    body,
    canonicalPath: '/',
    description: siteDescription,
    title: 'UrbanConnect | River Park Marketplace App',
  });
}

function buildHowItWorksHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">How it works</p>
        <h1>From listing to receipt, UrbanConnect keeps the flow clear.</h1>
        <p class="hero-lead">Residents shop, business owners list, customer care supports, and admin keeps the marketplace controlled.</p>
      </div>
    </section>
    <section class="section tight">
      <div class="shell steps-grid">
        <article class="card"><strong>1. Create or verify account</strong><p>Residents and business owners use the mobile app with account security, passcode, and biometric unlock where available.</p></article>
        <article class="card"><strong>2. Browse approved listings</strong><p>Customers choose products or services from River Park listings that have gone through admin review.</p></article>
        <article class="card"><strong>3. Pay and receive updates</strong><p>Payments are confirmed by the provider before receipts, wallet updates, and order progress are shown.</p></article>
      </div>
    </section>
    <section class="section band">
      <div class="shell screen-grid">
        <article class="screen-card"><img src="/assets/urbanconnect-screenshot-shop.svg" alt="Shop app screen" /><div class="screen-caption"><strong>Shop</strong><p>Find approved listings and view details.</p></div></article>
        <article class="screen-card"><img src="/assets/urbanconnect-screenshot-wallet.svg" alt="Wallet app screen" /><div class="screen-caption"><strong>Pay</strong><p>Use wallet, card, or bank payment.</p></div></article>
        <article class="screen-card"><img src="/assets/urbanconnect-screenshot-support.svg" alt="Support app screen" /><div class="screen-caption"><strong>Support</strong><p>Message customer care when help is needed.</p></div></article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/how-it-works/',
    body,
    canonicalPath: '/how-it-works/',
    description: 'Learn how UrbanConnect works for River Park shopping, payments, receipts, and customer care.',
    title: 'How UrbanConnect Works | River Park Marketplace',
  });
}

function buildAboutHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">About</p>
        <h1>UrbanConnect is built for controlled local commerce.</h1>
        <p class="hero-lead">The goal is a practical marketplace for River Park residents and business owners, with admin review and customer care at the center.</p>
      </div>
    </section>
    <section class="section tight">
      <div class="shell feature-grid">
        <article class="feature-card"><span class="feature-icon">A</span><strong>Local focus</strong><p>UrbanConnect keeps discovery tied to River Park so residents can shop from trusted local sellers.</p></article>
        <article class="feature-card"><span class="feature-icon">B</span><strong>Operational control</strong><p>Admin and customer care tools help manage listings, payments, orders, and support records.</p></article>
        <article class="feature-card"><span class="feature-icon">C</span><strong>Mobile first</strong><p>The public web explains the product. The customer experience belongs in the mobile app.</p></article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/about/',
    body,
    canonicalPath: '/about/',
    description: 'About UrbanConnect, a River Park marketplace app for local sellers, residents, customer care, and admin operations.',
    title: 'About UrbanConnect | River Park Marketplace',
  });
}

function buildContactHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">Contact</p>
        <h1>Reach UrbanConnect customer care.</h1>
        <p class="hero-lead">Use the contact details below for launch questions, support, app availability, and business owner onboarding.</p>
      </div>
    </section>
    <section class="section tight">
      <div class="shell contact-grid">
        <article class="contact-card">
          <strong>Email support</strong>
          <p>Customer care can help with launch questions, business onboarding, and app availability.</p>
          <div class="contact-list">
            <a href="mailto:${supportEmail}">${supportEmail}</a>
          </div>
        </article>
        <article class="contact-card">
          <strong>Admin access</strong>
          <p>The admin portal is private and desktop-only. It is not linked from the public website navigation.</p>
          <div class="contact-list">
            <span>Private desktop admin portal</span>
          </div>
        </article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/contact/',
    body,
    canonicalPath: '/contact/',
    description: 'Contact UrbanConnect customer care for app launch questions, River Park business onboarding, and support.',
    title: 'Contact UrbanConnect | River Park Marketplace',
  });
}

function buildFlutterwaveReturnHtml(kind) {
  const isCancel = kind === 'cancel';
  const title = isCancel ? 'Payment cancelled' : 'Returning to UrbanConnect';
  const copy = isCancel
    ? 'This checkout was cancelled. Your UrbanConnect balance will not change unless Flutterwave later confirms a successful payment.'
    : 'Flutterwave has returned this checkout. Your UrbanConnect app will update after provider confirmation.';
  const deepLink = 'urbanconnect://payments/flutterwave';
  const canonicalPath = isCancel
    ? '/payments/flutterwave/cancel/'
    : '/payments/flutterwave/return/';
  const body = `<section class="page-hero payment-return-hero">
      <div class="shell">
        <p class="section-kicker">Flutterwave checkout</p>
        <h1>${title}</h1>
        <p class="hero-lead">${copy}</p>
        <div class="store-row">
          <a class="primary-link" href="${deepLink}">Open UrbanConnect</a>
          <a class="primary-link ghost" href="/">Back to website</a>
        </div>
      </div>
    </section>
    <script>
      (() => {
        const deepLink = '${deepLink}' + window.location.search;
        window.setTimeout(() => {
          window.location.href = deepLink;
        }, 450);
      })();
    </script>`;

  return buildDocument({
    activePath: '',
    body,
    canonicalPath,
    description: 'Private Flutterwave payment return page for UrbanConnect app checkout.',
    robots: 'noindex,nofollow',
    title: `${title} | UrbanConnect`,
  });
}

async function writePage(distDir, route, html) {
  if (route === '/') {
    await fs.writeFile(path.join(distDir, 'index.html'), html);
    return;
  }

  const routeDir = path.join(distDir, route.replace(/^\/|\/$/g, ''));
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(path.join(routeDir, 'index.html'), html);
}

export async function prepareWebOutput(rootDir) {
  const siteUrl = normalizeBaseUrl(process.env.URBANCONNECT_SITE_URL);
  const distDir = path.join(rootDir, 'dist');
  const indexPath = path.join(distDir, 'index.html');
  const expoIndex = await fs.readFile(indexPath, 'utf8');
  const adminDir = path.join(distDir, adminPath);
  const appDir = path.join(distDir, appPath);
  const assetsDir = path.join(distDir, 'assets');
  const adminIndex = expoIndex
    .replace('<title>UrbanConnect</title>', '<title>UrbanConnect Admin</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const appIndex = expoIndex
    .replace('<title>UrbanConnect</title>', '<title>UrbanConnect Login</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const routes = ['/', '/how-it-works/', '/about/', '/contact/'];
  const lastmod = new Date().toISOString().slice(0, 10);
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /${adminPath}
Sitemap: ${siteUrl}/sitemap.xml
`;
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}${route}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  await fs.mkdir(adminDir, { recursive: true });
  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(adminDir, 'index.html'), adminIndex);
  await fs.writeFile(path.join(appDir, 'index.html'), appIndex);
  await fs.writeFile(path.join(assetsDir, 'urbanconnect-mark.svg'), logoSvg);
  await Promise.all(
    Object.entries(assetMap).map(([filename, svg]) =>
      fs.writeFile(path.join(assetsDir, filename), svg),
    ),
  );
  await fs.writeFile(path.join(distDir, 'robots.txt'), robotsTxt);
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml);
  await writePage(distDir, '/', buildHomeHtml());
  await writePage(distDir, '/how-it-works/', buildHowItWorksHtml());
  await writePage(distDir, '/about/', buildAboutHtml());
  await writePage(distDir, '/contact/', buildContactHtml());
  await writePage(distDir, '/payments/flutterwave/return/', buildFlutterwaveReturnHtml('return'));
  await writePage(distDir, '/payments/flutterwave/cancel/', buildFlutterwaveReturnHtml('cancel'));
}
