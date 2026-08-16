import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const baseUrl = process.env.VIEW2CONNECT_CAPTURE_URL ?? 'http://localhost:8099';
const captureTarget = process.argv[2] ?? 'phone';
const captureProfiles = {
  phone: {
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    outputFolder: '',
    viewport: { width: 540, height: 960 },
  },
  '7-inch': {
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    outputFolder: '7-inch-tablet',
    viewport: { width: 900, height: 1600 },
  },
  '10-inch': {
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    outputFolder: '10-inch-tablet',
    viewport: { width: 900, height: 1600 },
  },
  chromebook: {
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    outputFolder: 'chromebook',
    viewport: { width: 1920, height: 1080 },
  },
};
const captureProfile = captureProfiles[captureTarget];

if (!captureProfile) {
  throw new Error(`Unknown capture target: ${captureTarget}`);
}

const outputDir = path.resolve('play-store-assets', captureProfile.outputFolder);
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const storeCover =
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=86';
const captureStoreProducts = [
  {
    id: 'capture-store-grocery-basket',
    estateId: 'river-park',
    listingType: 'product',
    listingSource: 'sellerPortal',
    listingAudience: 'storeProduct',
    status: 'active',
    subscriptionCycle: 'monthly',
    subscriptionStatus: 'active',
    verifiedAmount: 0,
    subscriptionItemCount: 4,
    name: 'Fresh Grocery Basket',
    ownerName: 'FreshMart Groceries & Kitchen',
    ownerEmail: 'freshmart@example.com',
    cluster: 'Cluster 5',
    category: 'Groceries',
    description: 'A colourful selection of fresh vegetables and everyday cooking essentials.',
    longDescription:
      'Carefully selected tomatoes, peppers, onions, leafy vegetables and pantry essentials packed for convenient home delivery.',
    imageUrl:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=86',
    media: [
      {
        id: 'capture-store-grocery-basket-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=86',
        label: 'Fresh grocery basket',
      },
    ],
    address: 'River Park Estate, Lugbe, Abuja',
    stockQuantity: 24,
    reorderLevel: 6,
    price: 18500,
    priceLabel: 'Store price',
    responseTime: 'Ready in 20-30 minutes',
    verified: true,
    riverParkVerified: true,
    services: ['Store pickup', 'Packed for delivery'],
    tags: ['Store owner', 'Seller portal listing', 'Groceries'],
    contact: {
      phone: '+2348012345678',
      whatsapp: '+2348012345678',
      email: 'freshmart@example.com',
    },
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'capture-store-jollof-chicken',
    estateId: 'river-park',
    listingType: 'product',
    listingSource: 'sellerPortal',
    listingAudience: 'storeProduct',
    status: 'active',
    subscriptionCycle: 'monthly',
    subscriptionStatus: 'active',
    verifiedAmount: 0,
    subscriptionItemCount: 4,
    name: 'Jollof Rice & Grilled Chicken',
    ownerName: 'FreshMart Groceries & Kitchen',
    ownerEmail: 'freshmart@example.com',
    cluster: 'Cluster 5',
    category: 'Food',
    description: 'Smoky party jollof rice served with grilled chicken and fresh coleslaw.',
    longDescription:
      'Prepared fresh to order and packed securely for pickup or dispatch delivery.',
    imageUrl:
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1000&q=86',
    media: [
      {
        id: 'capture-store-jollof-chicken-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1000&q=86',
        label: 'Jollof rice and grilled chicken',
      },
    ],
    address: 'River Park Estate, Lugbe, Abuja',
    stockQuantity: 18,
    reorderLevel: 5,
    price: 6500,
    priceLabel: 'Store price',
    responseTime: 'Ready in 25-35 minutes',
    verified: true,
    riverParkVerified: true,
    services: ['Freshly prepared', 'Packed for delivery'],
    tags: ['Store owner', 'Seller portal listing', 'Food'],
    contact: {
      phone: '+2348012345678',
      whatsapp: '+2348012345678',
      email: 'freshmart@example.com',
    },
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'capture-store-fruit-box',
    estateId: 'river-park',
    listingType: 'product',
    listingSource: 'sellerPortal',
    listingAudience: 'storeProduct',
    status: 'active',
    subscriptionCycle: 'monthly',
    subscriptionStatus: 'active',
    verifiedAmount: 0,
    subscriptionItemCount: 4,
    name: 'Seasonal Fruit Box',
    ownerName: 'FreshMart Groceries & Kitchen',
    ownerEmail: 'freshmart@example.com',
    cluster: 'Cluster 5',
    category: 'Groceries',
    description: 'Fresh seasonal fruit selected and packed for homes, offices and gifting.',
    longDescription: 'A balanced mix of quality seasonal fruit supplied according to availability.',
    imageUrl:
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1000&q=86',
    media: [
      {
        id: 'capture-store-fruit-box-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1000&q=86',
        label: 'Seasonal fruit box',
      },
    ],
    address: 'River Park Estate, Lugbe, Abuja',
    stockQuantity: 14,
    reorderLevel: 4,
    price: 12000,
    priceLabel: 'Store price',
    responseTime: 'Ready in 15-20 minutes',
    verified: true,
    riverParkVerified: true,
    services: ['Packed fresh', 'Store pickup'],
    tags: ['Store owner', 'Seller portal listing', 'Groceries'],
    contact: {
      phone: '+2348012345678',
      whatsapp: '+2348012345678',
      email: 'freshmart@example.com',
    },
    createdAt: '2026-08-01T11:00:00.000Z',
  },
  {
    id: 'capture-store-bread-eggs',
    estateId: 'river-park',
    listingType: 'product',
    listingSource: 'sellerPortal',
    listingAudience: 'storeProduct',
    status: 'active',
    subscriptionCycle: 'monthly',
    subscriptionStatus: 'active',
    verifiedAmount: 0,
    subscriptionItemCount: 4,
    name: 'Breakfast Essentials Pack',
    ownerName: 'FreshMart Groceries & Kitchen',
    ownerEmail: 'freshmart@example.com',
    cluster: 'Cluster 5',
    category: 'Food & Groceries',
    description: 'Bread, eggs, milk and cereal combined for an easy family breakfast.',
    longDescription: 'A practical breakfast bundle packed together for convenient ordering.',
    imageUrl:
      'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1000&q=86',
    media: [
      {
        id: 'capture-store-bread-eggs-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1000&q=86',
        label: 'Breakfast essentials',
      },
    ],
    address: 'River Park Estate, Lugbe, Abuja',
    stockQuantity: 20,
    reorderLevel: 5,
    price: 9800,
    priceLabel: 'Store price',
    responseTime: 'Ready in 15-20 minutes',
    verified: true,
    riverParkVerified: true,
    services: ['Store pickup', 'Packed for delivery'],
    tags: ['Store owner', 'Seller portal listing', 'Food & Groceries'],
    contact: {
      phone: '+2348012345678',
      whatsapp: '+2348012345678',
      email: 'freshmart@example.com',
    },
    createdAt: '2026-08-01T12:00:00.000Z',
  },
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });

async function hideCaptureOnlyUi(page) {
  const testBanner = page.getByText(
    'Local test mode - Supabase reads and writes are off',
    { exact: true },
  );

  if (await testBanner.isVisible().catch(() => false)) {
    await testBanner.evaluate((node) => {
      const banner = node.parentElement;
      if (banner) banner.style.display = 'none';
    });
  }
}

async function capture(page, fileName) {
  await hideCaptureOnlyUi(page);
  await page.evaluate(() => {
    window.scrollTo({ left: 0, top: window.scrollY });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  });
  await page
    .waitForFunction(
      () =>
        Array.from(document.images)
          .filter((image) => image.getBoundingClientRect().width > 0)
          .every((image) => image.complete),
      { timeout: 12_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(1_500);
  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: false,
  });
}

async function openPrimarySection(page, label) {
  if (captureTarget === '7-inch' || captureTarget === '10-inch') {
    const yByLabel = {
      Home: 122,
      Shop: 188,
      Food: 255,
      Messages: 321,
      Profile: 388,
    };
    const y = yByLabel[label];

    if (!y) throw new Error(`Unknown compact tablet navigation label: ${label}`);
    await page.mouse.click(58, y);
    return;
  }

  await page.getByText(label, { exact: true }).click();
}

async function seedCaptureData(page) {
  await page.evaluate(
    ({ products, coverImage }) => {
      const businessKey = 'urbanconnect.localTest.businesses.v3';
      const profileKey = 'urbanconnect.localTest.ownerBusinessProfiles.v2';
      const usersKey = 'urbanconnect.localTest.users.v2';
      const cartKey = 'urbanconnect.localTest.cart.v2';
      const locationsKey = 'urbanconnect.localTest.customerDeliveryLocations.v1';
      const chatsKey = 'urbanconnect.localTest.chats.v2';
      const ordersKey = 'urbanconnect.localTest.orders.v3';
      const businesses = JSON.parse(window.localStorage.getItem(businessKey) || '[]');
      const profiles = JSON.parse(window.localStorage.getItem(profileKey) || '[]');
      const users = JSON.parse(window.localStorage.getItem(usersKey) || '[]');

      window.localStorage.setItem(
        businessKey,
        JSON.stringify([
          ...businesses.filter((business) => !String(business.id).startsWith('capture-store-')),
          ...products,
        ]),
      );
      window.localStorage.setItem(
        profileKey,
        JSON.stringify([
          ...profiles.filter((profile) => profile.id !== 'capture-store-profile'),
          {
            id: 'capture-store-profile',
            ownerUserId: 'capture-store-owner',
            ownerName: 'Amara Okafor',
            accountName: 'FreshMart Groceries & Kitchen',
            accountEmail: 'freshmart@example.com',
            bio: 'Fresh groceries and homestyle meals prepared for busy households.',
            profileImage: coverImage,
            phone: '+2348012345678',
            whatsapp: '+2348012345678',
            email: 'freshmart@example.com',
            website: '',
            instagram: '@freshmartng',
            facebook: 'FreshMart Nigeria',
            x: '@freshmartng',
            tiktok: '@freshmartng',
            address: 'River Park Estate, Lugbe, Abuja',
            openingTime: '08:00',
            closingTime: '20:00',
            openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            coverImage,
            galleryImages: '',
            galleryVideos: '',
            riverParkVerified: true,
            updatedAt: '2026-08-01T12:00:00.000Z',
          },
        ]),
      );
      window.localStorage.setItem(
        usersKey,
        JSON.stringify(
          users.map((user) =>
            user.email === 'buyer@test.urbanconnect.local'
              ? {
                  ...user,
                  firstName: 'Alex',
                  lastName: 'Customer',
                  fullName: 'Alex Customer',
                }
              : user,
          ),
        ),
      );
      window.localStorage.setItem(
        cartKey,
        JSON.stringify([
          {
            businessId: 'capture-store-grocery-basket',
            quantity: 2,
            userId: 'local-test-buyer',
            updatedAt: '2026-08-07T10:00:00.000Z',
          },
          {
            businessId: 'capture-store-jollof-chicken',
            quantity: 1,
            userId: 'local-test-buyer',
            updatedAt: '2026-08-07T10:01:00.000Z',
          },
        ]),
      );
      window.localStorage.setItem(
        locationsKey,
        JSON.stringify([
          {
            userId: 'local-test-buyer',
            formattedAddress: 'River Park Estate, Lugbe, Abuja, Nigeria',
            country: 'Nigeria',
            stateOrRegion: 'Federal Capital Territory',
            city: 'Abuja',
            areaOrDistrict: 'Lugbe',
            streetName: 'River Park Estate Road',
            buildingInfo: 'House 18',
            landmark: 'Near the estate gate',
            latitude: 8.9716,
            longitude: 7.3674,
            additionalInstructions: 'Call when you arrive at the gate.',
            source: 'pin',
            updatedAt: '2026-08-07T10:05:00.000Z',
          },
        ]),
      );
      window.localStorage.setItem(
        chatsKey,
        JSON.stringify({
          'ad-ife-laptop': [
            {
              id: 'capture-chat-1',
              businessId: 'ad-ife-laptop',
              senderUserId: 'local-test-buyer',
              recipientUserId: 'advertiser-ifeoma',
              senderName: 'Alex Customer',
              senderType: 'resident',
              text: 'Hello, is the HP EliteBook still available?',
              createdAt: '2026-08-07T09:40:00.000Z',
            },
            {
              id: 'capture-chat-2',
              businessId: 'ad-ife-laptop',
              senderUserId: 'advertiser-ifeoma',
              recipientUserId: 'local-test-buyer',
              senderName: 'Ifeoma Eze',
              senderType: 'owner',
              text: 'Yes, it is available and ready for inspection in Maitama.',
              createdAt: '2026-08-07T09:42:00.000Z',
            },
            {
              id: 'capture-chat-3',
              businessId: 'ad-ife-laptop',
              senderUserId: 'local-test-buyer',
              recipientUserId: 'advertiser-ifeoma',
              senderName: 'Alex Customer',
              senderType: 'resident',
              text: 'Great. I will confirm a convenient time shortly.',
              createdAt: '2026-08-07T09:44:00.000Z',
            },
          ],
        }),
      );
      window.localStorage.setItem(
        ordersKey,
        JSON.stringify([
          {
            id: 'V2C-20260807-1042',
            userId: 'local-test-buyer',
            userEmail: 'buyer@test.urbanconnect.local',
            userName: 'Alex Customer',
            estateId: 'river-park',
            deliveryAddress: 'River Park Estate, Lugbe, Abuja, Nigeria',
            deliveryCluster: 'Cluster 5',
            deliveryContactPhone: '+2348012345678',
            deliveryLocation: {
              userId: 'local-test-buyer',
              formattedAddress: 'River Park Estate, Lugbe, Abuja, Nigeria',
              country: 'Nigeria',
              stateOrRegion: 'Federal Capital Territory',
              city: 'Abuja',
              areaOrDistrict: 'Lugbe',
              streetName: 'River Park Estate Road',
              buildingInfo: 'House 18',
              landmark: 'Near the estate gate',
              latitude: 8.9716,
              longitude: 7.3674,
              additionalInstructions: 'Call when you arrive at the gate.',
              source: 'pin',
              updatedAt: '2026-08-07T10:05:00.000Z',
            },
            note: 'Call when you arrive at the estate gate.',
            items: [
              {
                businessId: 'capture-store-grocery-basket',
                businessName: 'Fresh Grocery Basket',
                ownerName: 'FreshMart Groceries & Kitchen',
                quantity: 2,
                unitPrice: 18500,
                lineTotal: 37000,
              },
              {
                businessId: 'capture-store-jollof-chicken',
                businessName: 'Jollof Rice & Grilled Chicken',
                ownerName: 'FreshMart Groceries & Kitchen',
                quantity: 1,
                unitPrice: 6500,
                lineTotal: 6500,
              },
            ],
            subtotal: 43500,
            sellerPackingSupport: 500,
            serviceFee: 4500,
            deliveryFee: 0,
            totalAmount: 48500,
            paymentMethod: 'flutterwave',
            paymentStatus: 'paid',
            status: 'outForDelivery',
            createdAt: '2026-08-07T10:08:00.000Z',
            updatedAt: '2026-08-07T10:40:00.000Z',
            expectedDeliveryAt: '2026-08-07T11:20:00.000Z',
            timeline: [
              {
                id: 'capture-order-event-1',
                status: 'placed',
                label: 'Order placed',
                note: 'Payment confirmed and the store received your order.',
                createdAt: '2026-08-07T10:08:00.000Z',
              },
              {
                id: 'capture-order-event-2',
                status: 'packed',
                label: 'Packed by seller',
                note: 'FreshMart completed packing and released the order for pickup.',
                createdAt: '2026-08-07T10:28:00.000Z',
              },
              {
                id: 'capture-order-event-3',
                status: 'outForDelivery',
                label: 'Out for delivery',
                note: 'Your dispatch rider is travelling to the saved delivery pin.',
                createdAt: '2026-08-07T10:40:00.000Z',
              },
            ],
          },
        ]),
      );
    },
    { products: captureStoreProducts, coverImage: storeCover },
  );
}

async function loginAsBuyer(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('body').waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(8_000);
  await seedCaptureData(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5_000);
  await page.getByLabel('Open sign in', { exact: true }).click();
  await page.getByText('Customer', { exact: true }).click();
  await page.getByPlaceholder('email@example.com', { exact: true }).fill(
    'buyer@test.urbanconnect.local',
  );
  await page.getByPlaceholder('Enter your password', { exact: true }).fill('password123');
  await page.getByText('Login', { exact: true }).click();
  await page.getByText('Welcome to View2Connect', { exact: true }).waitFor({ timeout: 15_000 });

  const gotIt = page.getByText('Got it', { exact: true });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();

  const updatesTitle = page.getByText('View2Connect updates.', { exact: true });
  if (await updatesTitle.isVisible().catch(() => false)) {
    await updatesTitle.evaluate((node) => {
      const closeButton = node.parentElement?.parentElement?.lastElementChild;
      if (closeButton instanceof HTMLElement) closeButton.click();
    });
    await updatesTitle.waitFor({ state: 'hidden', timeout: 5_000 });
  }

  await page.waitForTimeout(1_000);
}

try {
  const context = await browser.newContext({
    colorScheme: 'light',
    deviceScaleFactor: captureProfile.deviceScaleFactor,
    hasTouch: captureProfile.hasTouch,
    isMobile: captureProfile.isMobile,
    viewport: captureProfile.viewport,
  });
  const page = await context.newPage();

  await loginAsBuyer(page);
  await capture(page, '01-customer-home-and-adverts.png');

  await openPrimarySection(page, 'Shop');
  await page.waitForTimeout(2_000);
  await capture(page, '02-store-and-product-browsing.png');

  await page.getByText('View store', { exact: true }).click();
  const addItemButton = page.getByText('+', { exact: true });
  await addItemButton.waitFor({ timeout: 10_000 });
  await addItemButton.scrollIntoViewIfNeeded();
  await addItemButton.click();
  await addItemButton.click();
  await page.waitForTimeout(500);
  if (captureTarget === 'phone') {
    await page.mouse.click(442, 65);
  } else {
    await page.getByText('Cart', { exact: true }).click();
  }
  await page.getByText('Your cart', { exact: true }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  await capture(page, '03-product-details-and-cart.png');

  const routeHeading = page.getByText('Search location', { exact: true });
  await routeHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_000);
  await capture(page, '04-delivery-location-selection.png');

  await openPrimarySection(page, 'Messages');
  await page.getByText('Ifeoma Eze', { exact: true }).click();
  await page.waitForTimeout(1_000);
  await capture(page, '05-messages.png');

  await openPrimarySection(page, 'Profile');
  await page.getByText('V2C-20260807-1042', { exact: true }).scrollIntoViewIfNeeded();
  await page.getByText('V2C-20260807-1042', { exact: true }).click();
  await page.waitForTimeout(1_000);
  await capture(page, '06-order-tracking.png');

  await page.getByText('Back', { exact: true }).click();
  await openPrimarySection(page, 'Profile');
  await page.waitForTimeout(1_000);
  await capture(page, '07-customer-profile.png');

  const benefitsButton = page.getByText('Subscriptions & benefits', { exact: true });
  await benefitsButton.scrollIntoViewIfNeeded();
  await benefitsButton.click();
  await page.waitForTimeout(1_000);
  await capture(page, '08-benefits-and-subscription.png');

  console.log(`Captured eight View2Connect ${captureTarget} screenshots.`);

  await context.close();
} finally {
  await browser.close();
}
