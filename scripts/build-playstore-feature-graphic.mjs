import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const outputDir = path.resolve('play-store-assets');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function imageDataUrl(filePath) {
  const extension = path.extname(filePath).slice(1).replace('jpg', 'jpeg');
  const bytes = await fs.readFile(filePath);
  return `data:image/${extension};base64,${bytes.toString('base64')}`;
}

const [logo, home, stores, order] = await Promise.all([
  imageDataUrl(path.resolve('dist/favicon-512x512.png')),
  imageDataUrl(path.join(outputDir, '01-customer-home-and-adverts.png')),
  imageDataUrl(path.join(outputDir, '02-store-and-product-browsing.png')),
  imageDataUrl(path.join(outputDir, '06-order-tracking.png')),
]);

const browser = await chromium.launch({ executablePath: edgePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          html, body { width: 1024px; height: 500px; margin: 0; overflow: hidden; }
          body {
            background: #26104b;
            color: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }
          .canvas { position: relative; width: 1024px; height: 500px; overflow: hidden; }
          .accent-top { position: absolute; top: 0; left: 0; width: 1024px; height: 10px; background: #f25b39; }
          .accent-side { position: absolute; left: 0; bottom: 0; width: 14px; height: 126px; background: #f25b39; }
          .copy { position: absolute; z-index: 10; left: 54px; top: 58px; width: 390px; }
          .brand { display: flex; align-items: center; gap: 18px; }
          .logo {
            width: 82px;
            height: 82px;
            border: 5px solid rgba(255,255,255,.92);
            border-radius: 22px;
          }
          .name { margin: 0; font-size: 40px; line-height: .98; font-weight: 800; letter-spacing: 0; }
          .tagline { margin: 34px 0 0; font-size: 27px; line-height: 1.28; font-weight: 700; letter-spacing: 0; }
          .supporting { margin: 16px 0 0; max-width: 350px; color: #ded3f3; font-size: 18px; line-height: 1.45; }
          .labels { display: flex; gap: 9px; margin-top: 28px; }
          .label {
            border: 1px solid rgba(255,255,255,.28);
            border-radius: 7px;
            background: rgba(255,255,255,.1);
            padding: 9px 12px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .phones { position: absolute; inset: 0; }
          .phone {
            position: absolute;
            overflow: hidden;
            border: 7px solid #ffffff;
            border-radius: 28px;
            background: #ffffff;
            box-shadow: 0 18px 40px rgba(0,0,0,.34);
          }
          .phone img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
          .phone-one { left: 480px; top: 100px; width: 175px; height: 311px; transform: rotate(-5deg); opacity: .92; }
          .phone-two { left: 610px; top: 42px; z-index: 3; width: 226px; height: 402px; }
          .phone-three { left: 810px; top: 85px; width: 190px; height: 338px; transform: rotate(5deg); opacity: .92; }
          .footer-line { position: absolute; right: 0; bottom: 0; width: 600px; height: 16px; background: #5f2bd7; }
        </style>
      </head>
      <body>
        <main class="canvas">
          <div class="accent-top"></div>
          <div class="accent-side"></div>
          <section class="copy">
            <div class="brand">
              <img class="logo" src="${logo}" alt="" />
              <h1 class="name">View2Connect</h1>
            </div>
            <p class="tagline">Shop local. Post adverts.<br />Track every order.</p>
            <p class="supporting">Groceries, food, local stores and customer advertisements in one connected marketplace.</p>
            <div class="labels">
              <span class="label">Shop</span>
              <span class="label">Advertise</span>
              <span class="label">Track</span>
            </div>
          </section>
          <section class="phones" aria-label="View2Connect application screens">
            <div class="phone phone-one"><img src="${home}" alt="" /></div>
            <div class="phone phone-two"><img src="${stores}" alt="" /></div>
            <div class="phone phone-three"><img src="${order}" alt="" /></div>
          </section>
          <div class="footer-line"></div>
        </main>
      </body>
    </html>
  `);
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
  await page.screenshot({ path: path.join(outputDir, 'feature-graphic-1024x500.png') });
} finally {
  await browser.close();
}

console.log('Built play-store-assets/feature-graphic-1024x500.png');
