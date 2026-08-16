import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { loadProjectEnv } from '@expo/env';

import { buildSellerRegistrationHtml } from './seller-registration-template.mjs';

loadProjectEnv(process.cwd(), { silent: true });

const adminPath = 'admin-portal';
const catalogAdminPath = 'catalog-admin';
const appPath = 'app';
const sellerPortalPath = 'seller-portal';
const sellerDesktopPath = 'seller-desktop';
const defaultSiteUrl = 'https://www.view2connect.ng';
const defaultSellerDesktopDownloadUrl =
  'https://github.com/urbanconnect45-creator/urbanconnect/releases/download/seller-desktop-v1.0.2/View2Connect-Seller-Portal-Setup.exe';
const siteName = 'View2Connect';
const siteDescription =
  'View2Connect is a CAC-registered Nigerian marketplace where customers discover products, food, local stores, secure payments, receipts, and delivery updates.';
const supportEmail = 'support@view2connect.ng';
const publicSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publicSupabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
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

const socialLinks = [
  {
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(defaultSiteUrl)}`,
    icon: 'f',
    label: 'Share View2Connect on Facebook',
  },
  {
    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(defaultSiteUrl)}&text=${encodeURIComponent('Shop and sell with View2Connect')}`,
    icon: 'x',
    label: 'Share View2Connect on X',
  },
  {
    href: `https://wa.me/?text=${encodeURIComponent(`Shop and sell with View2Connect: ${defaultSiteUrl}`)}`,
    icon: 'wa',
    label: 'Share View2Connect on WhatsApp',
  },
  {
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(defaultSiteUrl)}`,
    icon: 'in',
    label: 'Share View2Connect on LinkedIn',
  },
];

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
  <title id="title">View2Connect</title>
  <desc id="desc">View2Connect commerce bag mark</desc>
  <rect width="160" height="160" rx="34" fill="#5B2BCB"/>
  <path d="M49 59h62l8 62H41l8-62Z" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linejoin="round"/>
  <path d="M61 62V49c0-14 9-24 21-24s21 10 21 24v13" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
  <text x="68" y="105" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="900" fill="#FFFFFF">2</text>
  <circle cx="120" cy="119" r="14" fill="#F06038" stroke="#5B2BCB" stroke-width="5"/>
</svg>`;

const assetMap = {
  'urbanconnect-carousel-market.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 760" role="img" aria-labelledby="title desc">
  <title id="title">View2Connect marketplace hero</title>
  <desc id="desc">A bright marketplace scene with local shopping, wallet status, and support cards.</desc>
  <rect width="1440" height="760" fill="#EAF3EE"/>
  <rect x="74" y="74" width="1292" height="612" rx="42" fill="#12372A"/>
  <rect x="124" y="128" width="426" height="504" rx="30" fill="#FFFFFF"/>
  <rect x="164" y="168" width="346" height="90" rx="18" fill="#DCEBE3"/>
  <text x="194" y="210" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="#12372A">Local shop</text>
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
  <title id="title">View2Connect payment hero</title>
  <desc id="desc">Wallet, card payment, bank transfer, and confirmed receipt cards.</desc>
  <rect width="1440" height="760" fill="#F4F7FA"/>
  <rect x="88" y="88" width="1264" height="584" rx="44" fill="#FFFFFF"/>
  <rect x="148" y="148" width="500" height="464" rx="34" fill="#12372A"/>
  <text x="204" y="226" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#CFE3D9">View2Connect wallet</text>
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
  <title id="title">View2Connect support hero</title>
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
  <title id="title">View2Connect app shopping screenshot</title>
  <desc id="desc">Mobile app screen showing local shop listings.</desc>
  <rect width="520" height="860" rx="44" fill="#16261F"/>
  <rect x="24" y="28" width="472" height="804" rx="34" fill="#F6F8F4"/>
  <rect x="54" y="62" width="412" height="126" rx="24" fill="#12372A"/>
  <text x="86" y="120" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="950" fill="#FFFFFF">Local shop</text>
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
  <title id="title">View2Connect wallet screenshot</title>
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
  <title id="title">View2Connect support screenshot</title>
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

function buildCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const crcTable = buildCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);

  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);

  return chunk;
}

function createPng(width, height, rgba) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * rowLength;
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND'),
  ]);
}

function drawPixel(rgba, size, x, y, color) {
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);

  if (roundedX < 0 || roundedY < 0 || roundedX >= size || roundedY >= size) {
    return;
  }

  const offset = (roundedY * size + roundedX) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function drawRect(rgba, size, x, y, width, height, color) {
  for (let currentY = y; currentY < y + height; currentY += 1) {
    for (let currentX = x; currentX < x + width; currentX += 1) {
      drawPixel(rgba, size, currentX, currentY, color);
    }
  }
}

function drawCircle(rgba, size, centerX, centerY, radius, color) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;

      if (dx * dx + dy * dy <= radius * radius) {
        drawPixel(rgba, size, x, y, color);
      }
    }
  }
}

function drawRoundedRect(rgba, size, color) {
  const radius = Math.round(size * 0.22);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const clampedX = Math.max(radius, Math.min(size - radius, x + 0.5));
      const clampedY = Math.max(radius, Math.min(size - radius, y + 0.5));
      const dx = x + 0.5 - clampedX;
      const dy = y + 0.5 - clampedY;

      if (dx * dx + dy * dy <= radius * radius) {
        drawPixel(rgba, size, x, y, color);
      }
    }
  }
}

function createFaviconPng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / 48;
  const purple = [91, 43, 203, 255];
  const white = [255, 255, 255, 255];
  const coral = [240, 96, 56, 255];

  drawRoundedRect(rgba, size, purple);

  drawRect(rgba, size, 13 * scale, 18 * scale, 3 * scale, 21 * scale, white);
  drawRect(rgba, size, 33 * scale, 18 * scale, 3 * scale, 21 * scale, white);
  drawRect(rgba, size, 13 * scale, 36 * scale, 23 * scale, 3 * scale, white);
  drawRect(rgba, size, 13 * scale, 18 * scale, 23 * scale, 3 * scale, white);
  drawCircle(rgba, size, 24 * scale, 15 * scale, 8 * scale, white);
  drawCircle(rgba, size, 24 * scale, 16 * scale, 5 * scale, purple);
  drawCircle(rgba, size, 36 * scale, 37 * scale, 6 * scale, coral);

  return createPng(size, size, rgba);
}

function createIcoFromPng(png, size) {
  const ico = Buffer.alloc(22 + png.length);

  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico[6] = size >= 256 ? 0 : size;
  ico[7] = size >= 256 ? 0 : size;
  ico[8] = 0;
  ico[9] = 0;
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);
  png.copy(ico, 22);

  return ico;
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/business-registration/', label: 'Business registration', mobileHidden: true },
  { href: '/seller-desktop/', label: 'Seller desktop', mobileHidden: true },
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
  const normalized = trimmed.replace(/\/+$/, '') || defaultSiteUrl;

  if (
    normalized === 'http://view2connect.ng' ||
    normalized === 'http://www.view2connect.ng' ||
    normalized === 'https://view2connect.ng'
  ) {
    return defaultSiteUrl;
  }

  return normalized;
}

function jsonLdScript(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function buildSocialLinks(className = 'social-links') {
  return `<div class="${className}" aria-label="Share View2Connect">
    ${socialLinks
      .map(
        (link) => `<a
          aria-label="${escapeHtml(link.label)}"
          href="${escapeHtml(link.href)}"
          rel="noopener noreferrer"
          target="_blank"
          title="${escapeHtml(link.label)}"
        ><span aria-hidden="true">${escapeHtml(link.icon)}</span></a>`,
      )
      .join('')}
  </div>`;
}

function buildHeader(activePath) {
  return `<header class="site-header">
    <a class="brand" href="/">
      <span class="brand-logo" aria-hidden="true">${logoSvg}</span>
      <span>
        <strong>View2Connect</strong>
        <span>CAC-registered marketplace</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-nav-toggle>
      <span></span><span></span><span></span>
    </button>
    <div class="header-actions" data-header-actions>
      <nav class="site-nav" aria-label="Main navigation">
        ${navLinks
          .map(
            (link) =>
              `<a class="${[
                link.href === activePath ? 'active' : '',
                link.mobileHidden ? 'mobile-web-hidden' : '',
              ]
                .filter(Boolean)
                .join(' ')}" href="${link.href}">${link.label}</a>`,
          )
          .join('')}
      </nav>
      ${buildSocialLinks('header-social-links')}
      <button class="nav-cta" type="button" data-store-button="View2Connect app">Get the app</button>
    </div>
  </header>`;
}

function buildFooter() {
  const year = new Date().getUTCFullYear();

  return `<footer class="footer" id="contact">
    <div>
      <strong>View2Connect</strong>
      <p>CAC-registered marketplace for products, food, secure payments, receipts, and delivery.</p>
    </div>
    <div class="footer-links">
      <a href="mailto:${supportEmail}">${supportEmail}</a>
      <a href="/privacy-policy/">Privacy Policy</a>
      <a href="/contact/">Contact</a>
      <a href="/about/">About</a>
    </div>
    ${buildSocialLinks('footer-social-links')}
    <div class="copyright">Copyright ${year} View2Connect. CAC registered. All rights reserved.</div>
  </footer>`;
}

function buildSharedHead({
  canonicalPath,
  description,
  includeDocumentBasics = true,
  robots = 'index,follow,max-image-preview:large',
  title,
}) {
  const siteUrl = normalizeBaseUrl(
    process.env.VIEW2CONNECT_SITE_URL ?? process.env.URBANCONNECT_SITE_URL,
  );
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const previewImageUrl = heroCarouselImages[0].src;
  const organizationJson = {
    '@context': 'https://schema.org',
    '@id': `${siteUrl}/#organization`,
    '@type': 'Organization',
    name: siteName,
    alternateName: 'View 2 Connect',
    url: siteUrl,
    logo: `${siteUrl}/favicon-512x512.png`,
    email: supportEmail,
    description: siteDescription,
    areaServed: {
      '@type': 'Country',
      name: 'Nigeria',
    },
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
    '@id': `${siteUrl}/#app`,
    '@type': 'SoftwareApplication',
    name: siteName,
    url: siteUrl,
    image: previewImageUrl,
    logo: `${siteUrl}/favicon-512x512.png`,
    applicationCategory: 'ShoppingApplication',
    operatingSystem: 'iOS, Android',
    description: siteDescription,
    publisher: {
      '@id': `${siteUrl}/#organization`,
    },
    featureList: [
      'Approved local marketplace listings',
      'Wallet and Flutterwave payments',
      'Receipts and delivery updates',
      'Customer care support',
      'Business registration review',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'NGN',
    },
  };

  return `${includeDocumentBasics ? `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />` : ''}
    <meta name="theme-color" content="#5B2BCB" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="preconnect" href="https://images.unsplash.com" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
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
        --ink: #21183a;
        --muted: #706a7c;
        --paper: #f8f7fb;
        --card: #ffffff;
        --line: #d9d2e5;
        --primary: #5b2bcb;
        --primary-soft: #eee8fb;
        --accent: #f06038;
        --gold: #f5c84c;
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
      .brand-logo {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 8px;
        overflow: hidden;
        flex: 0 0 auto;
      }
      .brand-logo svg {
        display: block;
        width: 100%;
        height: 100%;
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
      .header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
      }
      .nav-toggle {
        display: none;
        width: 44px;
        height: 44px;
        place-items: center;
        align-content: center;
        gap: 5px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 0;
      }
      .nav-toggle span {
        display: block;
        width: 20px;
        height: 2px;
        border-radius: 2px;
        background: var(--primary);
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
      .header-social-links,
      .footer-social-links {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .header-social-links a,
      .footer-social-links a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border: 1px solid var(--line);
        border-radius: 50%;
        background: var(--card);
        color: var(--primary);
        text-decoration: none;
        font-size: 12px;
        line-height: 1;
        font-weight: 950;
        text-transform: uppercase;
      }
      .header-social-links a:hover,
      .footer-social-links a:hover {
        border-color: var(--primary);
        background: var(--primary-soft);
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
      .policy-layout {
        display: grid;
        grid-template-columns: minmax(220px, 0.34fr) minmax(0, 1fr);
        gap: 36px;
        align-items: start;
      }
      .policy-summary {
        position: sticky;
        top: 96px;
        display: grid;
        gap: 12px;
        border-left: 4px solid var(--primary);
        padding: 6px 0 6px 18px;
        color: var(--muted);
        font-size: 15px;
        line-height: 24px;
        font-weight: 700;
      }
      .policy-summary strong {
        color: var(--ink);
        font-size: 20px;
      }
      .policy-summary a {
        color: var(--primary);
        overflow-wrap: anywhere;
      }
      .policy-sections {
        display: grid;
      }
      .policy-section {
        border-bottom: 1px solid var(--line);
        padding: 0 0 26px;
        margin: 0 0 26px;
      }
      .policy-section:last-child {
        margin-bottom: 0;
      }
      .policy-section h2 {
        margin: 0 0 10px;
        font-size: 22px;
        line-height: 30px;
      }
      .policy-section p {
        margin: 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 28px;
        font-weight: 650;
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
      .application-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.84fr) minmax(340px, 1.16fr);
        gap: 18px;
        align-items: start;
      }
      .registration-page {
        position: relative;
        isolation: isolate;
        min-height: calc(100vh - 90px);
        background-image:
          linear-gradient(rgba(20, 13, 38, 0.76), rgba(20, 13, 38, 0.82)),
          url("/assets/seller-registration-marketplace.png");
        background-position: center;
        background-size: cover;
        background-attachment: fixed;
      }
      .registration-page::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        background: rgba(26, 17, 45, 0.16);
      }
      .registration-page .page-hero h1,
      .registration-page .page-hero .hero-lead {
        color: #fff;
      }
      .registration-page .page-hero .section-kicker {
        color: #f5c84c;
      }
      .registration-page .application-panel {
        background: rgba(255, 255, 255, 0.97);
        box-shadow: 0 24px 70px rgba(12, 7, 24, 0.28);
      }
      .application-panel {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--card);
        padding: 22px;
        box-shadow: 0 18px 44px rgba(18, 32, 27, 0.08);
      }
      .application-list {
        display: grid;
        gap: 12px;
        margin-top: 20px;
      }
      .application-list div {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 14px;
      }
      .application-list strong {
        display: block;
        color: var(--ink);
        font-weight: 950;
      }
      .application-list span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 14px;
        line-height: 22px;
        font-weight: 700;
      }
      .business-form {
        display: grid;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .field {
        display: grid;
        gap: 7px;
      }
      .field.full {
        grid-column: 1 / -1;
      }
      .field label {
        color: var(--ink);
        font-size: 13px;
        line-height: 18px;
        font-weight: 950;
      }
      .field input,
      .field select,
      .field textarea {
        width: 100%;
        min-height: 48px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        padding: 12px 13px;
        font: inherit;
        font-size: 16px;
        font-weight: 700;
      }
      .field textarea {
        min-height: 118px;
        resize: vertical;
      }
      .field input:focus,
      .field select:focus,
      .field textarea:focus {
        border-color: var(--primary);
        outline: 3px solid rgba(18, 55, 42, 0.13);
      }
      .form-note,
      .form-status {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 23px;
        font-weight: 700;
      }
      .form-status {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--primary-soft);
        padding: 12px;
        color: var(--primary);
      }
      .onboarding-progress {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 16px;
      }
      .progress-step {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 10px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 900;
        text-align: center;
      }
      .progress-step.active {
        border-color: var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
      }
      .seller-type-grid,
      .plan-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .seller-type-card,
      .plan-card {
        display: grid;
        gap: 7px;
        min-height: 132px;
        border: 2px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 16px;
        color: var(--ink);
        text-align: left;
      }
      .seller-type-card strong,
      .plan-card strong {
        font-size: 18px;
        line-height: 24px;
      }
      .seller-type-card span,
      .plan-card span {
        color: var(--muted);
        font-size: 13px;
        line-height: 20px;
        font-weight: 700;
      }
      .seller-type-card.active,
      .plan-card:has(input:checked) {
        border-color: var(--primary);
        background: var(--primary-soft);
      }
      .seller-type-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--primary);
        color: #fff;
        font-weight: 950;
      }
      .plan-card {
        cursor: pointer;
      }
      .plan-card input {
        width: 18px;
        height: 18px;
        accent-color: var(--primary);
      }
      .plan-price {
        color: var(--primary) !important;
        font-size: 20px !important;
        line-height: 25px !important;
        font-weight: 950 !important;
      }
      .plan-benefits {
        display: grid;
        gap: 7px;
        margin: 3px 0 0;
        padding: 0;
        list-style: none;
      }
      .plan-benefits li {
        position: relative;
        padding-left: 20px;
        color: var(--muted);
        font-size: 13px;
        line-height: 19px;
        font-weight: 750;
      }
      .plan-benefits li::before {
        content: "✓";
        position: absolute;
        left: 0;
        color: var(--primary);
        font-weight: 950;
      }
      .plan-recommendation {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid var(--primary);
        border-radius: 8px;
        background: var(--primary-soft);
        padding: 12px 14px;
      }
      .plan-recommendation strong {
        color: var(--primary);
      }
      .account-summary {
        display: grid;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--primary-soft);
        padding: 14px;
      }
      .account-summary span {
        color: var(--muted);
        font-size: 13px;
        line-height: 20px;
        font-weight: 750;
      }
      .field input[readonly] {
        background: #f0edf5;
        color: var(--muted);
      }
      .otp-modal {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(16, 10, 28, 0.76);
      }
      .otp-dialog {
        width: min(440px, 100%);
        display: grid;
        gap: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        padding: 20px;
        box-shadow: 0 26px 76px rgba(12, 7, 24, 0.34);
      }
      .otp-dialog h2 {
        font-size: 25px;
        line-height: 31px;
      }
      .otp-code {
        width: 100%;
        min-height: 58px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        padding: 10px 14px;
        font: inherit;
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0;
        text-align: center;
      }
      .otp-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .button-loading {
        pointer-events: none;
        opacity: 0.68;
      }
      .form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .secondary-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        border: 1px solid var(--primary);
        border-radius: 8px;
        background: #fff;
        color: var(--primary);
        padding: 0 16px;
        text-decoration: none;
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
      .footer-social-links {
        justify-content: flex-end;
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
      .desktop-web-only-message {
        display: none;
      }
      .desktop-web-message-card {
        max-width: 720px;
        margin: 0 auto;
        display: grid;
        gap: 10px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(18, 55, 42, 0.08);
      }
      .desktop-web-message-card h2 {
        margin: 0;
        font-size: clamp(28px, 5vw, 34px);
        line-height: 1.08;
      }
      .desktop-web-message-card p {
        margin: 0;
        color: var(--muted);
      }

      @media (max-width: 920px) {
        .site-header {
          align-items: center;
          flex-direction: row;
          flex-wrap: wrap;
        }
        .nav-toggle {
          display: grid;
          margin-left: auto;
        }
        .header-actions {
          display: none;
          width: 100%;
          align-items: stretch;
          flex-direction: column;
          gap: 10px;
          padding-top: 4px;
        }
        .header-social-links {
          justify-content: center;
        }
        .site-header.menu-open .header-actions {
          display: flex;
        }
        .site-nav {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          justify-content: stretch;
        }
        .site-nav a {
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #fff;
          text-align: center;
        }
        .nav-cta {
          width: 100%;
        }
        .mobile-web-hidden {
          display: none !important;
        }
        .seller-desktop-only {
          display: none !important;
        }
        .desktop-web-only-message {
          display: block;
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
        .application-grid,
        .policy-layout,
        .footer {
          grid-template-columns: 1fr;
        }
        .policy-summary {
          position: static;
        }
        .application-grid > .application-panel:first-child {
          order: 2;
        }
        .application-grid > .application-panel:last-child {
          order: 1;
        }
        .footer-links {
          justify-content: flex-start;
        }
        .footer-social-links {
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
        .form-grid {
          grid-template-columns: 1fr;
        }
        .seller-type-grid,
        .plan-grid {
          grid-template-columns: 1fr;
        }
        .registration-page {
          background-attachment: scroll;
          background-position: 38% center;
        }
        .registration-page .page-hero {
          padding: 54px 0 30px;
        }
        .registration-page .section {
          padding-bottom: 42px;
        }
        .onboarding-progress {
          grid-template-columns: repeat(2, 1fr);
        }
        .application-panel {
          padding: 16px;
        }
        .otp-actions {
          grid-template-columns: 1fr;
        }
      }
    </style>`;
}

function buildLaunchModal() {
  const launchMessage =
    'View2Connect is still in review. App Store and Google Play launch soon.';

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
    <script>
      (() => {
        const toggle = document.querySelector('[data-nav-toggle]');
        const header = toggle?.closest('.site-header');
        const actions = document.querySelector('[data-header-actions]');
        if (!toggle || !header || !actions) return;

        toggle.addEventListener('click', () => {
          const isOpen = header.classList.toggle('menu-open');
          toggle.setAttribute('aria-expanded', String(isOpen));
          toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        });

        actions.addEventListener('click', (event) => {
          if (event.target instanceof HTMLAnchorElement) {
            header.classList.remove('menu-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open navigation');
          }
        });
      })();
    </script>
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
        <div class="eyebrow">Built for customers and local businesses</div>
        <h1 id="hero-title">View2Connect</h1>
        <p class="hero-lead">
          A mobile-first marketplace for approved local listings, wallet and Flutterwave payments,
          receipts, delivery updates, customer care, and business onboarding.
        </p>
        <div class="store-row">
          <button class="store-button" type="button" data-store-button="App Store">App Store</button>
          <button class="store-button secondary" type="button" data-store-button="Google Play">Google Play</button>
          <a class="store-button web-link" href="/${appPath}/">Web</a>
          <a class="primary-link mobile-web-hidden" href="/business-registration/">Business registration</a>
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
            <h2>One focused app for local buying from trusted sellers.</h2>
          </div>
          <p class="section-copy">
            View2Connect keeps public web simple and moves the real customer experience to the mobile app,
            where identity, wallet, receipts, support, and orders stay connected.
          </p>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <span class="feature-icon">01</span>
            <strong>Approved listings</strong>
          <p>Businesses apply on the website, then customer care and admin review what customers can see.</p>
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
            <img src="/assets/urbanconnect-screenshot-shop.svg" alt="View2Connect shop screen" />
            <div class="screen-caption">
              <strong>Browse local listings</strong>
              <p>Open the app, choose approved products or services, and view listing details before adding to cart.</p>
            </div>
          </article>
          <article class="screen-card">
            <img src="/assets/urbanconnect-screenshot-wallet.svg" alt="View2Connect wallet screen" />
            <div class="screen-caption">
              <strong>Add funds or pay</strong>
              <p>Use card or bank payment through Flutterwave, then wait for provider-confirmed wallet updates.</p>
            </div>
          </article>
          <article class="screen-card">
            <img src="/assets/urbanconnect-screenshot-support.svg" alt="View2Connect customer care screen" />
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
          <strong>Contact View2Connect</strong>
          <p>For launch questions, store availability, support, or business owner onboarding, contact customer care.</p>
          <div class="contact-list">
            <a href="mailto:${supportEmail}">${supportEmail}</a>
            <span>View2Connect marketplace support</span>
          </div>
        </article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/',
    body,
    canonicalPath: '/',
    description: siteDescription,
    title: 'View2Connect | Local Marketplace App',
  });
}

function buildHowItWorksHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">How it works</p>
        <h1>From listing to receipt, View2Connect keeps the flow clear.</h1>
        <p class="hero-lead">Customers shop in the app, businesses apply through the website, customer care supports, and admin keeps the marketplace controlled.</p>
      </div>
    </section>
    <section class="section tight">
      <div class="shell steps-grid">
        <article class="card"><strong>1. Create user account</strong><p>Customers use the app with account security, passcode, and biometric unlock where available.</p></article>
        <article class="card"><strong>2. Businesses apply separately</strong><p>Store owners, food vendors, and service providers use the website business registration form before admin review.</p></article>
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
    description: 'Learn how View2Connect works for local shopping, payments, receipts, and delivery updates.',
    title: 'How View2Connect Works | Local Marketplace',
  });
}

function buildAboutHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">About</p>
        <h1>View2Connect is built for controlled local commerce.</h1>
        <p class="hero-lead">The goal is a practical marketplace for customers and business owners, with admin review and customer care at the center.</p>
      </div>
    </section>
    <section class="section tight">
      <div class="shell feature-grid">
        <article class="feature-card"><span class="feature-icon">A</span><strong>Local focus</strong><p>View2Connect keeps discovery tied to nearby sellers so customers can shop from trusted local businesses.</p></article>
        <article class="feature-card"><span class="feature-icon">B</span><strong>Operational control</strong><p>Admin and customer care tools help manage listings, payments, orders, and support records.</p></article>
        <article class="feature-card"><span class="feature-icon">C</span><strong>Mobile first</strong><p>The public web explains the product. The customer experience belongs in the mobile app.</p></article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/about/',
    body,
    canonicalPath: '/about/',
    description: 'About View2Connect, a CAC-registered local marketplace for sellers and customers.',
    title: 'About View2Connect | Local Marketplace',
  });
}

function buildBusinessRegistrationHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">Seller onboarding</p>
        <h1>Create a store owner account after email verification.</h1>
        <p class="hero-lead">Apply as a customer or store owner, choose Free or Gold, and finish signup only after your email code is confirmed.</p>
        <div class="store-row">
          <a class="primary-link" href="/${sellerPortalPath}/">Seller login</a>
        </div>
      </div>
    </section>
    <section class="section tight">
      <div class="shell application-grid">
        <aside class="application-panel">
          <p class="section-kicker">Before approval</p>
          <h2>What View2Connect will check.</h2>
          <p class="section-copy">
            Every seller can apply, including people selling only a few items. We review identity,
            pickup details, product readiness, and the ability to fulfil confirmed orders.
          </p>
          <div class="application-list">
            <div><strong>Separate accounts</strong><span>Your customer, store owner, and dispatch accounts stay separate.</span></div>
            <div><strong>Store owner</strong><span>Register a supermarket, retail store, food business, pharmacy, or established product catalog.</span></div>
            <div><strong>After approval</strong><span>Sign in to the seller portal and add products manually or import a CSV/Excel catalog.</span></div>
          </div>
        </aside>
        <article class="application-panel">
          <div class="onboarding-progress">
            <div class="progress-step active" data-progress-step="1">1. Seller type</div>
            <div class="progress-step" data-progress-step="2">2. Details</div>
            <div class="progress-step" data-progress-step="3">3. Plan</div>
          </div>

          <section class="business-form" data-seller-type-step>
            <div>
              <p class="section-kicker">Choose seller type</p>
              <h2>How would you like to continue?</h2>
              <p class="form-note">Customer login stays separate. Store owner signup is for sellers only.</p>
            </div>
            <div class="seller-type-grid">
              <button class="seller-type-card" type="button" data-customer-login>
                <span class="seller-type-icon">I</span>
                <strong>Customer</strong>
                <span>Go to the customer login and shopping app.</span>
              </button>
              <button class="seller-type-card" type="button" data-seller-type="store">
                <span class="seller-type-icon">S</span>
                <strong>Store owner</strong>
                <span>Bring an existing shop, food business, or product catalog online.</span>
              </button>
            </div>
          </section>

          <form class="business-form" data-business-registration-form hidden>
            <div>
              <p class="section-kicker">Application details</p>
              <h2 data-application-title>Tell us about your store.</h2>
              <p class="form-note">The email entered here becomes the dedicated store owner login after verification.</p>
            </div>
            <input name="sellerType" type="hidden" />
            <div class="form-grid">
              <div class="field">
                <label for="ownerName">Owner full name</label>
                <input id="ownerName" name="ownerName" autocomplete="name" required />
              </div>
              <div class="field">
                <label for="businessName" data-business-name-label>Business or store name</label>
                <input id="businessName" name="businessName" required />
              </div>
              <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" autocomplete="email" required />
              </div>
              <div class="field">
                <label for="phone">Phone / WhatsApp</label>
                <input id="phone" name="phone" autocomplete="tel" required />
              </div>
              <div class="field" data-store-only>
                <label for="businessType">Business type</label>
                <select id="businessType" name="businessType" required>
                  <option value="">Select type</option>
                  <option>Supermarket / grocery store</option>
                  <option>Food vendor / restaurant</option>
                  <option>Pharmacy / health store</option>
                  <option>Cosmetics / beauty store</option>
                  <option>Service provider</option>
                  <option>Other retail store</option>
                </select>
              </div>
              <div class="field">
                <label for="area">City / area</label>
                <input id="area" name="area" placeholder="Abuja, Lekki, Wuse 2" required />
              </div>
              <div class="field full">
                <label for="address">Pickup or business address</label>
                <input id="address" name="address" autocomplete="street-address" required />
              </div>
              <div class="field" data-store-only>
                <label for="cacNumber">CAC number</label>
                <input id="cacNumber" name="cacNumber" placeholder="Optional during early application" />
              </div>
              <div class="field" data-store-only>
                <label for="posSystem">POS or inventory system</label>
                <input id="posSystem" name="posSystem" placeholder="Prestige, Excel, manual, none" />
              </div>
              <div class="field" data-store-only>
                <label for="catalogReady">Product list status</label>
                <select id="catalogReady" name="catalogReady" required>
                  <option value="">Select status</option>
                  <option>I can export CSV or Excel</option>
                  <option>I have a product list but no export</option>
                  <option>I need help creating a product list</option>
                  <option>I sell services, not products</option>
                </select>
              </div>
              <div class="field full">
                <label for="notes">What do you sell?</label>
                <textarea id="notes" name="notes" required placeholder="Mention your main products, expected stock, food or menu type, and how orders can be collected."></textarea>
              </div>
            </div>
            <div class="form-actions">
              <button class="secondary-link" type="button" data-back-to-type>Back</button>
              <button class="primary-link" type="submit">Continue to plans</button>
            </div>
          </form>

          <form class="business-form" data-plan-step hidden>
            <div>
              <p class="section-kicker">Launch plan</p>
              <h2>Select your starting plan.</h2>
              <p class="form-note">These are introductory launch offers. Payment is requested only after the application is reviewed.</p>
            </div>
            <div class="plan-grid">
              <label class="plan-card" data-plan-audience="individual">
                <input name="plan" type="radio" value="Individual Free - 3 months" />
                <strong>Free Starter</strong>
                <span class="plan-price">Free</span>
                <span>3 months. Listings are reviewed and use standard placement; paid stores are prioritized first.</span>
              </label>
              <label class="plan-card" data-plan-audience="individual">
                <input name="plan" type="radio" value="Early Seller - 6 months - NGN 5,000" />
                <strong>Early Seller</strong>
                <span class="plan-price">₦5,000</span>
                <span>One introductory fee covering 6 months.</span>
              </label>
              <label class="plan-card" data-plan-audience="individual">
                <input name="plan" type="radio" value="Founding Seller - 12 months - NGN 9,000" />
                <strong>Founding Seller</strong>
                <span class="plan-price">₦9,000</span>
                <span>One introductory fee covering 12 months.</span>
              </label>
              <label class="plan-card" data-plan-audience="store">
                <input name="plan" type="radio" value="Store Launch - 3 months - NGN 15,000" />
                <strong>Store Launch</strong>
                <span class="plan-price">₦15,000</span>
                <span>Three months for a store or food business.</span>
              </label>
              <label class="plan-card" data-plan-audience="store">
                <input name="plan" type="radio" value="Store Growth - 6 months - NGN 25,000" />
                <strong>Store Growth</strong>
                <span class="plan-price">₦25,000</span>
                <span>Six months with catalog import access.</span>
              </label>
              <label class="plan-card" data-plan-audience="store">
                <input name="plan" type="radio" value="Store Pro - 12 months - NGN 45,000" />
                <strong>Store Pro</strong>
                <span class="plan-price">₦45,000</span>
                <span>Twelve months for an established store catalog.</span>
              </label>
            </div>
            <div class="form-actions">
              <button class="secondary-link" type="button" data-back-to-details>Back</button>
              <button class="primary-link" type="submit">Submit application</button>
            </div>
            <p class="form-status" data-business-registration-status hidden></p>
          </form>
        </article>
      </div>
    </section>
    <script>
      (() => {
        const typeStep = document.querySelector('[data-seller-type-step]');
        const form = document.querySelector('[data-business-registration-form]');
        const planStep = document.querySelector('[data-plan-step]');
        const status = document.querySelector('[data-business-registration-status]');
        const progressSteps = [...document.querySelectorAll('[data-progress-step]')];
        const typeButtons = [...document.querySelectorAll('[data-seller-type]')];
        const storeOnlyFields = [...document.querySelectorAll('[data-store-only]')];
        const planCards = [...document.querySelectorAll('[data-plan-audience]')];
        let sellerType = '';
        if (!typeStep || !form || !planStep) return;

        const showProgress = (activeStep) => {
          progressSteps.forEach((step) => {
            step.classList.toggle('active', step.dataset.progressStep === String(activeStep));
          });
        };

        const chooseSellerType = (nextType) => {
          sellerType = nextType;
          form.elements.sellerType.value = nextType;
          typeButtons.forEach((button) => {
            button.classList.toggle('active', button.dataset.sellerType === nextType);
          });
          storeOnlyFields.forEach((field) => {
            const control = field.querySelector('input, select');
            field.hidden = nextType !== 'store';
            if (control && (control.name === 'businessType' || control.name === 'catalogReady')) {
              control.required = nextType === 'store';
            }
          });
          const title = document.querySelector('[data-application-title]');
          const nameLabel = document.querySelector('[data-business-name-label]');
        if (title) {
          title.textContent = 'Tell us about your store.';
        }
        if (nameLabel) {
          nameLabel.textContent = 'Business or store name';
        }
          typeStep.hidden = true;
          form.hidden = false;
          planStep.hidden = true;
          showProgress(2);
        };

        typeButtons.forEach((button) => {
          button.addEventListener('click', () => chooseSellerType(button.dataset.sellerType));
        });

        document.querySelector('[data-back-to-type]')?.addEventListener('click', () => {
          typeStep.hidden = false;
          form.hidden = true;
          planStep.hidden = true;
          showProgress(1);
        });

        form.addEventListener('submit', (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          planCards.forEach((card) => {
            card.hidden = card.dataset.planAudience !== sellerType;
            const input = card.querySelector('input');
            if (input) {
              input.checked = false;
              input.required = card.dataset.planAudience === sellerType;
            }
          });
          form.hidden = true;
          planStep.hidden = false;
          showProgress(3);
        });

        document.querySelector('[data-back-to-details]')?.addEventListener('click', () => {
          form.hidden = false;
          planStep.hidden = true;
          showProgress(2);
        });

        planStep.addEventListener('submit', (event) => {
          event.preventDefault();
          if (!planStep.reportValidity()) return;
          const data = new FormData(form);
          const planData = new FormData(planStep);
          const lines = [
            'View2Connect seller application',
            '',
            'Seller type: ' + sellerType,
            'Selected plan: ' + (planData.get('plan') || ''),
            'Owner full name: ' + (data.get('ownerName') || ''),
            'Business / display name: ' + (data.get('businessName') || ''),
            'Email: ' + (data.get('email') || ''),
            'Phone / WhatsApp: ' + (data.get('phone') || ''),
            'Business type: ' + (data.get('businessType') || ''),
            'City / area: ' + (data.get('area') || ''),
            'Pickup or business address: ' + (data.get('address') || ''),
            'CAC number: ' + (data.get('cacNumber') || ''),
            'POS or inventory system: ' + (data.get('posSystem') || ''),
            'Product list status: ' + (data.get('catalogReady') || ''),
            '',
            'What they sell:',
            String(data.get('notes') || ''),
          ];
          const subject = 'View2Connect seller application - ' + (data.get('businessName') || 'New seller');
          const mailto = 'mailto:${supportEmail}?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\\n'));
          if (status) {
            status.hidden = false;
            status.textContent = 'Opening your email app. Send the prepared message to submit this application for review.';
          }
          window.location.href = mailto;
        });

        const requestedType = new URLSearchParams(window.location.search).get('sellerType');
        if (requestedType === 'individual') {
          window.location.assign('/app/');
        } else if (requestedType === 'store') {
          chooseSellerType('store');
        }
      })();
    </script>`;

  return buildDocument({
    activePath: '/business-registration/',
    body,
    canonicalPath: '/business-registration/',
    description: 'Apply as a store owner, keep customer login separate, and select a View2Connect launch plan.',
    title: 'Seller Registration | View2Connect',
  });
}

function buildSellerDesktopHtml({ desktopDownloadUrl }) {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">Seller desktop app</p>
        <h1>Run your seller portal as a Windows desktop app.</h1>
        <p class="hero-lead">Install the View2Connect Seller Portal on a Windows 10 or Windows 11 laptop or desktop. It opens directly to your store dashboard, catalog, orders, and account tools.</p>
        <div class="store-row">
          <a class="primary-link" href="${escapeHtml(desktopDownloadUrl)}">Download for Windows</a>
          <a class="primary-link ghost" href="/${sellerPortalPath}/">Use seller portal in browser</a>
        </div>
      </div>
    </section>
    <section class="section tight">
      <div class="shell feature-grid">
        <article class="feature-card"><span class="feature-icon">01</span><strong>Install once</strong><p>Download the setup file, run the installer, and choose where it should be installed.</p></article>
        <article class="feature-card"><span class="feature-icon">02</span><strong>Sign in securely</strong><p>Use the same separate store owner account you use in the browser. Customer and dispatch accounts cannot enter the seller portal.</p></article>
        <article class="feature-card"><span class="feature-icon">03</span><strong>Keep it current</strong><p>The app opens the live seller portal, so catalog and order changes remain connected to the same Supabase data.</p></article>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/seller-desktop/',
    body,
    canonicalPath: '/seller-desktop/',
    description: 'Download the View2Connect Seller Portal Windows desktop app for store owner catalog and order management.',
    title: 'Download Seller Portal for Windows | View2Connect',
  });
}

function buildContactHtml() {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">Contact</p>
        <h1>Reach View2Connect customer care.</h1>
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
    description: 'Contact View2Connect for app launch questions, business onboarding, and support.',
    title: 'Contact View2Connect | Local Marketplace',
  });
}

function buildPrivacyPolicyHtml(policy) {
  const body = `<section class="page-hero">
      <div class="shell">
        <p class="section-kicker">Legal</p>
        <h1>${escapeHtml(policy.title)}</h1>
        <p class="hero-lead">Effective date: ${escapeHtml(policy.effectiveDate)}</p>
      </div>
    </section>
    <section class="section tight">
      <div class="shell policy-layout">
        <div class="policy-summary">
          <strong>${escapeHtml(policy.companyName)}</strong>
          <span>This policy applies to the View2Connect app, website, seller portal, dispatch portal, and support services.</span>
          <a href="mailto:${escapeHtml(policy.contactEmail)}">${escapeHtml(policy.contactEmail)}</a>
        </div>
        <div class="policy-sections">
          ${policy.sections
            .map(
              (section) => `<section class="policy-section">
            <h2>${escapeHtml(section.title)}</h2>
            <p>${escapeHtml(section.body)}</p>
          </section>`,
            )
            .join('')}
        </div>
      </div>
    </section>`;

  return buildDocument({
    activePath: '/privacy-policy/',
    body,
    canonicalPath: '/privacy-policy/',
    description:
      'View2Connect Privacy Policy covering accounts, marketplace listings, payments, delivery, location, messages, data retention, and account deletion.',
    title: `${policy.title} | View2Connect`,
  });
}

function buildFlutterwaveReturnHtml(kind) {
  const isCancel = kind === 'cancel';
  const title = isCancel ? 'Payment cancelled' : 'Returning to View2Connect';
  const copy = isCancel
    ? 'This checkout was cancelled. Your View2Connect balance will not change unless Flutterwave later confirms a successful payment.'
    : 'Flutterwave has returned this checkout. Your View2Connect app will update after provider confirmation.';
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
          <a class="primary-link" href="${deepLink}">Open View2Connect</a>
          <a class="primary-link ghost" href="/">Back to website</a>
        </div>
      </div>
    </section>
    <script>
      (() => {
        const deepLink = '${deepLink}' + window.location.search;
        const webReturn = window.sessionStorage.getItem('view2connect.flutterwave.webReturn');
        if (webReturn === '1') {
          window.sessionStorage.removeItem('view2connect.flutterwave.webReturn');
          const query = window.location.search.replace(/^\\?/, '');
          window.location.replace('/?paymentReturn=flutterwave' + (query ? '&' + query : ''));
          return;
        }
        const returnToApp = () => {
          window.location.href = deepLink;
        };
        window.setTimeout(returnToApp, 80);
        window.addEventListener('pageshow', () => {
          window.setTimeout(returnToApp, 80);
        }, { once: true });
      })();
    </script>`;

  return buildDocument({
    activePath: '',
    body,
    canonicalPath,
    description: 'Private Flutterwave payment return page for View2Connect app checkout.',
    robots: 'noindex,nofollow',
    title: `${title} | View2Connect`,
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
  const siteUrl = normalizeBaseUrl(
    process.env.VIEW2CONNECT_SITE_URL ?? process.env.URBANCONNECT_SITE_URL,
  );
  const sellerDesktopDownloadUrl =
    process.env.VIEW2CONNECT_SELLER_DESKTOP_DOWNLOAD_URL?.trim() ||
    defaultSellerDesktopDownloadUrl;
  const distDir = path.join(rootDir, 'dist');
  const privacyPolicyDocument = JSON.parse(
    await fs.readFile(path.join(rootDir, 'src', 'data', 'privacyPolicy.json'), 'utf8'),
  );
  const indexPath = path.join(distDir, 'index.html');
  const expoIndex = await fs.readFile(indexPath, 'utf8');
  const brandedExpoIndex = expoIndex
    .replace(
      'width=device-width, initial-scale=1, shrink-to-fit=no',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    )
    .replace(
      '</head>',
      '    <style>html, body { background: #f8f7fb; } input, textarea, select { font-size: 16px !important; }</style>\n  </head>',
    );
  const adminDir = path.join(distDir, adminPath);
  const catalogAdminDir = path.join(distDir, catalogAdminPath);
  const appDir = path.join(distDir, appPath);
  const sellerPortalDir = path.join(distDir, sellerPortalPath);
  const assetsDir = path.join(distDir, 'assets');
  const adminIndex = brandedExpoIndex
    .replace('<title>View2Connect</title>', '<title>View2Connect Admin</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const catalogAdminIndex = brandedExpoIndex
    .replace('<title>View2Connect</title>', '<title>View2Connect Catalog Studio</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const appIndex = brandedExpoIndex
    .replace('<title>View2Connect</title>', '<title>View2Connect Login</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const sellerPortalIndex = brandedExpoIndex
    .replace('<title>View2Connect</title>', '<title>View2Connect Store Owner Dashboard</title>')
    .replace('</head>', '    <meta name="robots" content="noindex,nofollow" />\n  </head>');
  const storeDescription =
    'Shop products, food, groceries, and local stores across Nigeria with View2Connect. Customers can browse approved sellers, pay securely, receive receipts, and follow delivery updates.';
  const storeIndex = brandedExpoIndex
    .replace(
      '<title>View2Connect</title>',
      buildSharedHead({
        canonicalPath: '/',
        description: storeDescription,
        includeDocumentBasics: false,
        title: 'View2Connect Nigeria | Shop Products, Food and Local Stores',
      }),
    )
    .replace(
      'You need to enable JavaScript to run this app.',
      'View2Connect is a Nigerian marketplace for products, food, groceries, local stores, secure payments, receipts, seller onboarding, and delivery updates.',
    );
  const routes = [
    '/',
    '/how-it-works/',
    '/business-registration/',
    '/seller-desktop/',
    '/about/',
    '/contact/',
    '/privacy-policy/',
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /${adminPath}
Disallow: /${catalogAdminPath}
Disallow: /${sellerPortalPath}
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
  await fs.mkdir(catalogAdminDir, { recursive: true });
  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(sellerPortalDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(adminDir, 'index.html'), adminIndex);
  await fs.writeFile(path.join(catalogAdminDir, 'index.html'), catalogAdminIndex);
  await fs.writeFile(path.join(appDir, 'index.html'), appIndex);
  await fs.writeFile(path.join(sellerPortalDir, 'index.html'), sellerPortalIndex);
  await fs.writeFile(indexPath, storeIndex);
  const favicon48 = createFaviconPng(48);
  const favicon96 = createFaviconPng(96);
  const favicon180 = createFaviconPng(180);
  const favicon192 = createFaviconPng(192);
  const favicon256 = createFaviconPng(256);
  const favicon512 = createFaviconPng(512);
  await fs.writeFile(path.join(distDir, 'favicon-48x48.png'), favicon48);
  await fs.writeFile(path.join(distDir, 'favicon-96x96.png'), favicon96);
  await fs.writeFile(path.join(distDir, 'favicon-192x192.png'), favicon192);
  await fs.writeFile(path.join(distDir, 'favicon-512x512.png'), favicon512);
  await fs.writeFile(path.join(distDir, 'apple-touch-icon.png'), favicon180);
  await fs.writeFile(path.join(distDir, 'favicon.ico'), createIcoFromPng(favicon256, 256));
  await fs.writeFile(path.join(distDir, 'favicon.svg'), logoSvg);
  await fs.writeFile(path.join(assetsDir, 'view2connect-mark.svg'), logoSvg);
  await fs.writeFile(path.join(assetsDir, 'urbanconnect-mark.svg'), logoSvg);
  await fs.writeFile(
    path.join(distDir, 'site.webmanifest'),
    JSON.stringify(
      {
        name: siteName,
        short_name: siteName,
        description: siteDescription,
        start_url: '/',
        display: 'standalone',
        background_color: '#F8F7FB',
        theme_color: '#5B2BCB',
        icons: [
          {
            src: '/favicon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/favicon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      null,
      2,
    ),
  );
  await fs.copyFile(
    path.join(rootDir, 'assets', 'seller-registration-marketplace.png'),
    path.join(assetsDir, 'seller-registration-marketplace.png'),
  );
  await Promise.all(
    Object.entries(assetMap).map(([filename, svg]) =>
      fs.writeFile(path.join(assetsDir, filename), svg),
    ),
  );
  await fs.writeFile(path.join(distDir, 'robots.txt'), robotsTxt);
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml);
  await writePage(distDir, '/how-it-works/', buildHowItWorksHtml());
  await writePage(
    distDir,
    '/business-registration/',
    buildDocument({
      activePath: '/business-registration/',
      body: buildSellerRegistrationHtml({
        publicSupabaseKey,
        publicSupabaseUrl,
        sellerDesktopPath,
        sellerPortalPath,
      }),
      canonicalPath: '/business-registration/',
      description:
        'Apply as a store owner, choose Free or Gold, and create a separate seller account after email verification.',
      title: 'Seller Registration | View2Connect',
    }),
  );
  await writePage(
    distDir,
    '/seller-desktop/',
    buildSellerDesktopHtml({ desktopDownloadUrl: sellerDesktopDownloadUrl }),
  );
  await writePage(distDir, '/about/', buildAboutHtml());
  await writePage(distDir, '/contact/', buildContactHtml());
  await writePage(
    distDir,
    '/privacy-policy/',
    buildPrivacyPolicyHtml(privacyPolicyDocument),
  );
  await writePage(distDir, '/payments/flutterwave/return/', buildFlutterwaveReturnHtml('return'));
  await writePage(distDir, '/payments/flutterwave/cancel/', buildFlutterwaveReturnHtml('cancel'));
}
