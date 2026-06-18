import fs from 'node:fs/promises';
import path from 'node:path';

const adminPath = 'admin-portal';
const defaultSiteUrl = 'https://urbanconnectstore.com';
const siteDescription =
  'UrbanConnect is the River Park marketplace app for approved products, services, support, payments, and delivery updates.';

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect</title>
  <desc id="desc">UrbanConnect UC location mark</desc>
  <rect width="160" height="160" rx="34" fill="#12372A"/>
  <path d="M35 105c17-17 33-25 48-25s29 8 42 25" fill="none" stroke="#F2B84B" stroke-width="16" stroke-linecap="round"/>
  <text x="35" y="82" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="900" fill="#FFFFFF">UC</text>
  <path d="M116 33c-13 0-24 11-24 24 0 18 24 43 24 43s24-25 24-43c0-13-11-24-24-24zm0 34a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" fill="#EF6A4E"/>
</svg>`;

const carouselAssets = [
  {
    filename: 'urbanconnect-carousel-market.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect local marketplace preview</title>
  <desc id="desc">A polished marketplace scene with local listings, order status, and residents shopping from the UrbanConnect app.</desc>
  <rect width="960" height="640" fill="#F6F8F4"/>
  <rect x="56" y="58" width="848" height="524" rx="38" fill="#12372A"/>
  <rect x="96" y="96" width="360" height="448" rx="28" fill="#FFFFFF"/>
  <rect x="126" y="126" width="300" height="88" rx="18" fill="#DCEBE3"/>
  <text x="150" y="165" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#12372A">River Park picks</text>
  <text x="150" y="195" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#65746B">Approved products near you</text>
  <rect x="126" y="246" width="132" height="132" rx="18" fill="#EF6A4E"/>
  <rect x="294" y="246" width="132" height="132" rx="18" fill="#2F6F9F"/>
  <rect x="126" y="410" width="300" height="84" rx="18" fill="#FFF4DF"/>
  <text x="150" y="446" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#12372A">Order placed</text>
  <text x="150" y="474" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#7D5A12">Receipt sent after payment</text>
  <circle cx="606" cy="182" r="62" fill="#F2B84B"/>
  <rect x="545" y="260" width="244" height="164" rx="26" fill="#FFFFFF"/>
  <text x="584" y="318" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#12372A">Shop local</text>
  <text x="584" y="356" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="#607168">Products, services, and support in one app.</text>
  <path d="M546 468h244" stroke="#F2B84B" stroke-width="18" stroke-linecap="round"/>
  <path d="M546 512h164" stroke="#EF6A4E" stroke-width="18" stroke-linecap="round"/>
</svg>`,
  },
  {
    filename: 'urbanconnect-carousel-wallet.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect wallet and Flutterwave payment preview</title>
  <desc id="desc">Wallet balance, card payment, and bank transfer confirmation shown in the UrbanConnect visual style.</desc>
  <rect width="960" height="640" fill="#F3F6FA"/>
  <rect x="58" y="70" width="844" height="500" rx="38" fill="#FFFFFF"/>
  <rect x="100" y="112" width="386" height="416" rx="30" fill="#12372A"/>
  <text x="140" y="170" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#CFE3D9">UrbanConnect wallet</text>
  <text x="140" y="238" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="950" fill="#FFFFFF">Paid</text>
  <rect x="140" y="292" width="272" height="72" rx="18" fill="#F2B84B"/>
  <text x="168" y="338" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="950" fill="#12372A">Provider confirmed</text>
  <rect x="140" y="404" width="306" height="72" rx="18" fill="#244A3D"/>
  <text x="168" y="450" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="900" fill="#FFFFFF">Receipt emailed</text>
  <rect x="544" y="132" width="270" height="166" rx="26" fill="#EF6A4E"/>
  <rect x="584" y="180" width="184" height="20" rx="10" fill="#FFFFFF" opacity=".82"/>
  <rect x="584" y="220" width="98" height="20" rx="10" fill="#FFFFFF" opacity=".56"/>
  <rect x="544" y="342" width="270" height="166" rx="26" fill="#2F6F9F"/>
  <circle cx="604" cy="425" r="34" fill="#FFFFFF" opacity=".9"/>
  <rect x="660" y="398" width="110" height="20" rx="10" fill="#FFFFFF" opacity=".82"/>
  <rect x="660" y="438" width="78" height="20" rx="10" fill="#FFFFFF" opacity=".56"/>
</svg>`,
  },
  {
    filename: 'urbanconnect-carousel-support.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-labelledby="title desc">
  <title id="title">UrbanConnect customer care preview</title>
  <desc id="desc">Customer care and admin operations preview for support, verification, and delivery updates.</desc>
  <rect width="960" height="640" fill="#F8F6F1"/>
  <rect x="74" y="78" width="812" height="484" rx="36" fill="#12372A"/>
  <rect x="120" y="126" width="332" height="388" rx="28" fill="#FFFFFF"/>
  <text x="158" y="182" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="950" fill="#12372A">Customer care</text>
  <rect x="158" y="228" width="232" height="52" rx="14" fill="#DCEBE3"/>
  <rect x="158" y="308" width="178" height="52" rx="14" fill="#FFF4DF"/>
  <rect x="158" y="388" width="250" height="52" rx="14" fill="#DDE9F2"/>
  <circle cx="614" cy="226" r="86" fill="#F2B84B"/>
  <rect x="540" y="340" width="276" height="116" rx="24" fill="#FFFFFF"/>
  <text x="584" y="390" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="950" fill="#12372A">Verified help</text>
  <text x="584" y="426" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#607168">Orders, payments, and IDs stay organized.</text>
  <path d="M560 500h230" stroke="#EF6A4E" stroke-width="18" stroke-linecap="round"/>
</svg>`,
  },
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

function buildLandingHtml() {
  const siteUrl = normalizeBaseUrl(process.env.URBANCONNECT_SITE_URL);
  const logoUrl = `${siteUrl}/assets/urbanconnect-mark.svg`;
  const previewImageUrl = `${siteUrl}/assets/urbanconnect-carousel-market.svg`;
  const launchMessage =
    'UrbanConnect is still in review. App Store and Google Play launch soon.';
  const organizationJson = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'UrbanConnect',
    url: siteUrl,
    logo: logoUrl,
    description: siteDescription,
  };
  const websiteJson = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'UrbanConnect',
    url: siteUrl,
    description: siteDescription,
  };
  const appJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'UrbanConnect',
    applicationCategory: 'ShoppingApplication',
    operatingSystem: 'iOS, Android',
    description: siteDescription,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'NGN',
    },
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#12372A" />
    <meta name="description" content="${escapeHtml(siteDescription)}" />
    <link rel="canonical" href="${escapeHtml(siteUrl)}/" />
    <link rel="icon" type="image/svg+xml" href="/assets/urbanconnect-mark.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="UrbanConnect" />
    <meta property="og:title" content="UrbanConnect | River Park Marketplace App" />
    <meta property="og:description" content="${escapeHtml(siteDescription)}" />
    <meta property="og:url" content="${escapeHtml(siteUrl)}/" />
    <meta property="og:image" content="${escapeHtml(previewImageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="UrbanConnect | River Park Marketplace App" />
    <meta name="twitter:description" content="${escapeHtml(siteDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(previewImageUrl)}" />
    <script type="application/ld+json">${jsonLdScript(organizationJson)}</script>
    <script type="application/ld+json">${jsonLdScript(websiteJson)}</script>
    <script type="application/ld+json">${jsonLdScript(appJson)}</script>
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

      [hidden] {
        display: none !important;
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

      button,
      a {
        color: inherit;
        font: inherit;
      }

      button {
        cursor: pointer;
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
        border-radius: 8px;
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
        text-align: right;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 0.94fr) minmax(340px, 1.06fr);
        align-items: center;
        gap: 42px;
        padding: 48px 0 36px;
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
        font-size: 70px;
        line-height: 0.98;
        font-weight: 950;
        letter-spacing: 0;
      }

      .lead {
        max-width: 650px;
        margin: 0;
        color: #34443d;
        font-size: 18px;
        line-height: 30px;
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
        min-height: 52px;
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

      .visual-stage {
        display: grid;
        gap: 14px;
      }

      .carousel {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
        box-shadow: 0 24px 68px rgba(18, 32, 27, 0.16);
      }

      .carousel-slide {
        display: none;
        margin: 0;
      }

      .carousel-slide.is-active {
        display: block;
      }

      .carousel-slide img {
        display: block;
        width: 100%;
        aspect-ratio: 3 / 2;
        object-fit: cover;
        background: #eef4ef;
      }

      .carousel-caption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-top: 1px solid var(--line);
        padding: 16px;
      }

      .carousel-caption strong {
        display: block;
        font-size: 18px;
        line-height: 24px;
        font-weight: 950;
      }

      .carousel-caption span {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 13px;
        line-height: 19px;
        font-weight: 700;
      }

      .carousel-dots {
        display: inline-flex;
        gap: 8px;
        flex: 0 0 auto;
      }

      .carousel-dot {
        width: 30px;
        height: 10px;
        border: 0;
        border-radius: 999px;
        background: #cfdad3;
      }

      .carousel-dot.is-active {
        background: var(--accent);
      }

      .trust-strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .trust-item {
        min-height: 86px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
        padding: 14px;
      }

      .trust-item strong {
        display: block;
        font-size: 14px;
        line-height: 19px;
        font-weight: 950;
      }

      .trust-item span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 12px;
        line-height: 17px;
        font-weight: 700;
      }

      .sections {
        padding: 18px 0 54px;
      }

      .story-band {
        display: grid;
        grid-template-columns: minmax(0, 0.94fr) minmax(300px, 1.06fr);
        gap: 18px;
        margin-bottom: 18px;
      }

      .story,
      .info {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
        padding: 20px;
      }

      .story strong,
      .info strong {
        display: block;
        font-size: 18px;
        line-height: 24px;
        font-weight: 950;
      }

      .story p,
      .info p {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 22px;
        font-weight: 650;
      }

      .launch-list {
        display: grid;
        gap: 9px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .launch-list li {
        display: grid;
        grid-template-columns: 12px 1fr;
        gap: 10px;
        color: #34443d;
        font-size: 14px;
        line-height: 21px;
        font-weight: 750;
      }

      .launch-list li::before {
        content: "";
        width: 8px;
        height: 8px;
        margin-top: 7px;
        border-radius: 50%;
        background: var(--accent);
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }

      footer {
        border-top: 1px solid var(--line);
        padding: 24px 0 34px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 750;
      }

      .launch-modal {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(18, 32, 27, 0.58);
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

      @media (max-width: 920px) {
        .nav {
          align-items: flex-start;
          flex-direction: column;
        }

        .nav-copy {
          text-align: left;
        }

        .hero,
        .story-band {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 52px;
          line-height: 1.02;
        }

        .info-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 560px) {
        .shell {
          width: min(100% - 24px, 1120px);
        }

        .hero {
          gap: 26px;
          padding-top: 26px;
        }

        h1 {
          font-size: 40px;
          line-height: 1.04;
        }

        .lead {
          font-size: 16px;
          line-height: 26px;
        }

        .store-button {
          width: 100%;
        }

        .carousel-caption,
        .trust-strip {
          grid-template-columns: 1fr;
        }

        .carousel-caption {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="shell">
        <nav class="nav" aria-label="UrbanConnect">
          <a class="brand" href="${escapeHtml(siteUrl)}/">
            <img src="/assets/urbanconnect-mark.svg" alt="UrbanConnect logo" />
            <span>
              <strong>UrbanConnect</strong>
              <span>River Park marketplace</span>
            </span>
          </a>
          <div class="nav-copy">Mobile app only. Web is for launch information and support.</div>
        </nav>

        <section class="hero" aria-labelledby="hero-title">
          <div>
            <div class="eyebrow">Built for River Park residents and business owners</div>
            <h1 id="hero-title">UrbanConnect</h1>
            <p class="lead">
              A mobile marketplace for approved River Park listings, wallet and Flutterwave payments,
              receipts, delivery updates, customer care, and business owner tools.
            </p>
            <div class="store-row" id="download">
              <button class="store-button primary" type="button" data-store-button="App Store">
                <span class="store-icon">A</span>
                App Store
              </button>
              <button class="store-button secondary" type="button" data-store-button="Google Play">
                <span class="store-icon">P</span>
                Google Play
              </button>
            </div>
            <p class="note">
              The customer app is not available on mobile web. The store listings will open when the mobile app is approved.
            </p>
          </div>

          <div class="visual-stage" aria-label="UrbanConnect app previews">
            <div class="carousel">
              <figure class="carousel-slide is-active" data-carousel-slide>
                <img src="/assets/urbanconnect-carousel-market.svg" alt="UrbanConnect marketplace preview" />
                <figcaption class="carousel-caption">
                  <span>
                    <strong>Local marketplace</strong>
                    <span>Approved products and services for River Park residents.</span>
                  </span>
                  <span class="carousel-dots" aria-label="Carousel controls">
                    <button class="carousel-dot is-active" type="button" aria-label="Show marketplace preview" data-carousel-dot="0"></button>
                    <button class="carousel-dot" type="button" aria-label="Show wallet preview" data-carousel-dot="1"></button>
                    <button class="carousel-dot" type="button" aria-label="Show support preview" data-carousel-dot="2"></button>
                  </span>
                </figcaption>
              </figure>
              <figure class="carousel-slide" data-carousel-slide>
                <img src="/assets/urbanconnect-carousel-wallet.svg" alt="UrbanConnect wallet and payment preview" />
                <figcaption class="carousel-caption">
                  <span>
                    <strong>Provider confirmed payments</strong>
                    <span>Wallet, card, and bank flows stay tied to real payment status.</span>
                  </span>
                  <span class="carousel-dots" aria-label="Carousel controls">
                    <button class="carousel-dot" type="button" aria-label="Show marketplace preview" data-carousel-dot="0"></button>
                    <button class="carousel-dot is-active" type="button" aria-label="Show wallet preview" data-carousel-dot="1"></button>
                    <button class="carousel-dot" type="button" aria-label="Show support preview" data-carousel-dot="2"></button>
                  </span>
                </figcaption>
              </figure>
              <figure class="carousel-slide" data-carousel-slide>
                <img src="/assets/urbanconnect-carousel-support.svg" alt="UrbanConnect customer care preview" />
                <figcaption class="carousel-caption">
                  <span>
                    <strong>Support and verification</strong>
                    <span>Customer care, business review, and admin operations stay organized.</span>
                  </span>
                  <span class="carousel-dots" aria-label="Carousel controls">
                    <button class="carousel-dot" type="button" aria-label="Show marketplace preview" data-carousel-dot="0"></button>
                    <button class="carousel-dot" type="button" aria-label="Show wallet preview" data-carousel-dot="1"></button>
                    <button class="carousel-dot is-active" type="button" aria-label="Show support preview" data-carousel-dot="2"></button>
                  </span>
                </figcaption>
              </figure>
            </div>

            <div class="trust-strip" aria-label="UrbanConnect priorities">
              <div class="trust-item">
                <strong>Mobile first</strong>
                <span>Customer access belongs in the iOS and Android app.</span>
              </div>
              <div class="trust-item">
                <strong>Receipts</strong>
                <span>Email receipts follow confirmed transactions.</span>
              </div>
              <div class="trust-item">
                <strong>Private admin</strong>
                <span>Operations stay outside the public mobile website.</span>
              </div>
            </div>
          </div>
        </section>

        <section class="sections" aria-label="About UrbanConnect">
          <div class="story-band">
            <article class="story">
              <strong>About UrbanConnect</strong>
              <p>
                UrbanConnect is being built as a trusted marketplace layer for River Park. The app keeps buyers,
                sellers, payments, customer care, and delivery updates in one simple flow, with admin review behind the scenes.
              </p>
            </article>
            <article class="story">
              <strong>What the launch focuses on</strong>
              <ul class="launch-list">
                <li>Residents can browse approved products and services from local business owners.</li>
                <li>Payments and wallet top-ups are completed only after provider confirmation.</li>
                <li>Support, receipts, and business tools stay connected to the same account record.</li>
              </ul>
            </article>
          </div>

          <div class="info-grid">
            <article class="info">
              <strong>Marketplace</strong>
              <p>Approved listings help customers discover trusted local options without a messy public feed.</p>
            </article>
            <article class="info">
              <strong>Payments</strong>
              <p>Wallet, card, and bank activity is tracked through confirmed transaction status before receipts are issued.</p>
            </article>
            <article class="info">
              <strong>Operations</strong>
              <p>The admin dashboard is separate from the public website and available only through the private desktop path.</p>
            </article>
          </div>
        </section>

        <footer>
          UrbanConnect for River Park. Public website for app launch information only.
        </footer>
      </div>
    </main>

    <div class="launch-modal" data-launch-modal hidden>
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
        const slides = Array.from(document.querySelectorAll('[data-carousel-slide]'));
        const dots = Array.from(document.querySelectorAll('[data-carousel-dot]'));
        let activeSlide = 0;

        const showSlide = (index) => {
          if (!slides.length) {
            return;
          }

          activeSlide = (index + slides.length) % slides.length;
          slides.forEach((slide, slideIndex) => {
            slide.classList.toggle('is-active', slideIndex === activeSlide);
          });
          dots.forEach((dot) => {
            dot.classList.toggle('is-active', Number(dot.dataset.carouselDot) === activeSlide);
          });
        };

        dots.forEach((dot) => {
          dot.addEventListener('click', () => showSlide(Number(dot.dataset.carouselDot)));
        });

        if (slides.length > 1) {
          window.setInterval(() => showSlide(activeSlide + 1), 4800);
        }

        const closeModal = () => {
          modal?.setAttribute('hidden', '');
        };

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
          if (event.target === modal) {
            closeModal();
          }
        });

        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            closeModal();
          }
        });
      })();
    </script>
  </body>
</html>`;
}

export async function prepareWebOutput(rootDir) {
  const siteUrl = normalizeBaseUrl(process.env.URBANCONNECT_SITE_URL);
  const distDir = path.join(rootDir, 'dist');
  const indexPath = path.join(distDir, 'index.html');
  const expoIndex = await fs.readFile(indexPath, 'utf8');
  const adminDir = path.join(distDir, adminPath);
  const assetsDir = path.join(distDir, 'assets');
  const adminIndex = expoIndex
    .replace('<title>UrbanConnect</title>', '<title>UrbanConnect Admin</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /${adminPath}
Sitemap: ${siteUrl}/sitemap.xml
`;
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  await fs.mkdir(adminDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(adminDir, 'index.html'), adminIndex);
  await fs.writeFile(path.join(assetsDir, 'urbanconnect-mark.svg'), logoSvg);
  await Promise.all(
    carouselAssets.map((asset) =>
      fs.writeFile(path.join(assetsDir, asset.filename), asset.svg),
    ),
  );
  await fs.writeFile(path.join(distDir, 'robots.txt'), robotsTxt);
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml);
  await fs.writeFile(indexPath, buildLandingHtml());
}
