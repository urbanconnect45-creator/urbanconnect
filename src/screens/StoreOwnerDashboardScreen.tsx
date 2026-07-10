import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import { MediaPickerField } from '../components/MediaPickerField';
import { isUrbanConnectLocalTestMode } from '../config/runtime';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import {
  fetchFlutterwaveNigerianBanks,
  isSupabaseConfigured,
  saveVerifiedSellerPayoutAccountToSupabase,
  uploadMediaUriToSupabaseStorage,
  verifyFlutterwaveBusinessCac as verifyCacBusinessRegistration,
  verifySellerPayoutAccount,
} from '../services/supabaseApi';
import { splitInputList } from '../utils/businessMedia';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import {
  productCategories,
  riverParkClusters,
  type Business,
  type BusinessCategory,
  type BusinessProfileFormValues,
  type FlutterwaveBank,
  type Order,
  type OrderItem,
  type OwnerBusinessProfileValues,
  type WithdrawalKycType,
} from '../types/business';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';
import { getOrderStatusLabel } from '../utils/order';

type SellerPortalPage = 'dashboard' | 'orders' | 'items' | 'payments' | 'security' | 'profile';

function getInitialSellerPortalPage(): SellerPortalPage {
  if (Platform.OS !== 'web') {
    return 'dashboard';
  }

  const search =
    (globalThis as { location?: { search?: string } }).location?.search ?? '';
  const requestedPage = new URLSearchParams(search).get('page');

  return requestedPage === 'catalog' || requestedPage === 'items' ? 'items' : 'dashboard';
}

type ProductDraft = {
  itemName: string;
  category: BusinessCategory;
  price: string;
  stockQuantity: string;
  reorderLevel: string;
  hasBarcode: boolean;
  identifier: string;
  hasSize: boolean;
  size: string;
  area: string;
  pickupAddress: string;
  shortDescription: string;
  details: string;
};

type ListingEditDraft = {
  name: string;
  description: string;
  longDescription: string;
  category: BusinessCategory;
  address: string;
  price: string;
  stockQuantity: string;
  reorderLevel: string;
};

type ImportedProductRow = ProductDraft & {
  rowNumber: number;
};

type ProductImportField = Exclude<keyof ProductDraft, 'hasBarcode' | 'hasSize'>;

const fallbackProductImage =
  'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80';

const categoryFallbackImages: Record<string, string> = {
  Food:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  Drinks:
    'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=80',
  Electronics:
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=80',
  Beauty:
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
  Fashion:
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80',
  'Home Essentials':
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=900&q=80',
  Infant:
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80',
};

const sampleProductImportCsv = `itemName,category,price,stockQuantity,reorderLevel,identifier,size,area,pickupAddress,shortDescription,details
Jollof Rice and Chicken,Food,3500,12,3,,Plate,Wuse 2,"Shop 12 Banex Plaza, Wuse 2","Freshly prepared meal","Contains chicken and spices."
Orange Juice 50cl,Drinks,900,40,10,6154000031290,50cl,Gwarinpa,"Local Test Store, 3rd Avenue","Chilled orange drink","Serve cold."
Morning Fresh Dishwashing Liquid 500ml,Home Essentials,1200,8,2,NAFDAC-A8-2345,500ml,Lekki Phase 1,"Adeniran Ogunsanya Street","Dishwashing liquid 500ml","Household cleaning product ready for pickup."`;

const importHeaderAliases: Record<string, ProductImportField> = {
  item: 'itemName',
  itemname: 'itemName',
  name: 'itemName',
  product: 'itemName',
  productname: 'itemName',
  category: 'category',
  price: 'price',
  amount: 'price',
  stock: 'stockQuantity',
  quantity: 'stockQuantity',
  stockquantity: 'stockQuantity',
  reorder: 'reorderLevel',
  reorderlevel: 'reorderLevel',
  identifier: 'identifier',
  barcode: 'identifier',
  nafdac: 'identifier',
  sku: 'identifier',
  size: 'size',
  pack: 'size',
  measurement: 'size',
  area: 'area',
  city: 'area',
  pickupaddress: 'pickupAddress',
  address: 'pickupAddress',
  description: 'shortDescription',
  shortdescription: 'shortDescription',
  details: 'details',
  longdescription: 'details',
  note: 'details',
  notes: 'details',
};

const portalNav: {
  id: SellerPortalPage;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { id: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { id: 'items', label: 'Catalog', icon: 'cube-outline' },
  { id: 'payments', label: 'Payment method', icon: 'card-outline' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { id: 'profile', label: 'Profile', icon: 'storefront-outline' },
];

const kycOptions: { label: string; value: WithdrawalKycType }[] = [
  { label: 'BVN', value: 'bvn' },
  { label: 'NIN', value: 'nin' },
];

function initialDraft(userName = ''): ProductDraft {
  return {
    itemName: '',
    category: productCategories[0],
    price: '',
    stockQuantity: '1',
    reorderLevel: '1',
    hasBarcode: false,
    identifier: '',
    hasSize: false,
    size: '',
    area: '',
    pickupAddress: '',
    shortDescription: '',
    details: userName ? `Prepared by ${userName}.` : '',
  };
}

function normalizeImportHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function assetLabelFromUri(uri: string, fallbackPrefix: string, index: number) {
  const lastSegment = uri.split('/').pop()?.split('?')[0];
  return lastSegment && lastSegment.length > 0 ? lastSegment : `${fallbackPrefix} ${index + 1}`;
}

function assetsFromValue(value: string, fallbackPrefix: string) {
  return splitInputList(value).map((uri, index) => ({
    label: assetLabelFromUri(uri, fallbackPrefix, index),
    uri,
  }));
}

function getBarcodeCandidate(identifier: string) {
  const digits = identifier.replace(/\D/g, '');

  return digits.length >= 8 && digits.length <= 14 ? digits : undefined;
}

function getNestedImageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const front = record.front;

  if (front && typeof front === 'object') {
    const frontRecord = front as Record<string, unknown>;
    const display = frontRecord.display;
    const small = frontRecord.small;

    if (display && typeof display === 'object') {
      const displayRecord = display as Record<string, unknown>;
      const englishUrl = displayRecord.en;
      const firstUrl = Object.values(displayRecord).find((item) => typeof item === 'string');

      return typeof englishUrl === 'string'
        ? englishUrl
        : typeof firstUrl === 'string'
          ? firstUrl
          : undefined;
    }

    if (small && typeof small === 'object') {
      const smallRecord = small as Record<string, unknown>;
      const englishUrl = smallRecord.en;
      const firstUrl = Object.values(smallRecord).find((item) => typeof item === 'string');

      return typeof englishUrl === 'string'
        ? englishUrl
        : typeof firstUrl === 'string'
          ? firstUrl
          : undefined;
    }
  }

  return undefined;
}

async function lookupBarcodeImage(identifier: string) {
  const barcode = getBarcodeCandidate(identifier);

  if (!barcode) {
    return undefined;
  }

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=image_front_url,image_url,selected_images`,
    );

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      product?: {
        image_front_url?: string;
        image_url?: string;
        selected_images?: unknown;
      };
    };

    return (
      payload.product?.image_front_url ??
      payload.product?.image_url ??
      getNestedImageUrl(payload.product?.selected_images)
    );
  } catch {
    return undefined;
  }
}

async function lookupProductNameImage(product: ProductDraft) {
  const query = product.itemName.trim();

  if (!query) {
    return undefined;
  }

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1&fields=image_front_url,image_url,selected_images,product_name`,
    );

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      products?: {
        image_front_url?: string;
        image_url?: string;
        selected_images?: unknown;
      }[];
    };
    const productResult = payload.products?.[0];

    return (
      productResult?.image_front_url ??
      productResult?.image_url ??
      getNestedImageUrl(productResult?.selected_images)
    );
  } catch {
    return undefined;
  }
}

function getCategoryFallbackImageUrl(product: ProductDraft) {
  return categoryFallbackImages[product.category] ?? fallbackProductImage;
}

async function resolveProductImageUrl(product: ProductDraft) {
  return (
    (await lookupBarcodeImage(product.identifier)) ??
    (await lookupProductNameImage(product)) ??
    getCategoryFallbackImageUrl(product)
  );
}

function parseDelimitedLine(line: string, delimiter: ',' | '\t') {
  const cells: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseProductImportText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];

  if (lines.length < 2) {
    return { rows: [] as ImportedProductRow[], errors: ['Paste a header row and at least one product row.'] };
  }

  const headerLine = lines[0] ?? '';
  const delimiter: ',' | '\t' = headerLine.includes('\t') ? '\t' : ',';
  const rawHeaders = parseDelimitedLine(headerLine, delimiter);
  const mappedHeaders = rawHeaders.map(
    (header) => importHeaderAliases[normalizeImportHeader(header)],
  );
  const missingRequiredHeaders = ['itemName', 'price', 'stockQuantity', 'pickupAddress', 'shortDescription'].filter(
    (requiredHeader) => !mappedHeaders.includes(requiredHeader as ProductImportField),
  );

  if (missingRequiredHeaders.length > 0) {
    errors.push(`Missing required column(s): ${missingRequiredHeaders.join(', ')}.`);
  }

  const rows = lines.slice(1).reduce<ImportedProductRow[]>((parsedRows, line, index) => {
    const rowNumber = index + 2;
    const cells = parseDelimitedLine(line, delimiter);
    const row = initialDraft();

    mappedHeaders.forEach((mappedHeader, headerIndex) => {
      if (!mappedHeader) {
        return;
      }

      row[mappedHeader] = cells[headerIndex] ?? '';
    });

    const category = productCategories.find(
      (item) => item.toLowerCase() === row.category.trim().toLowerCase(),
    );
    row.category = category ?? productCategories[0];
    row.stockQuantity = row.stockQuantity.trim() || '1';
    row.reorderLevel = row.reorderLevel.trim() || '1';
    row.hasBarcode = Boolean(row.identifier.trim());
    row.hasSize = Boolean(row.size.trim());
    row.details = row.details.trim() || row.shortDescription.trim();

    const price = Number(row.price);
    const stockQuantity = Number(row.stockQuantity);
    const reorderLevel = Number(row.reorderLevel);

    if (!row.itemName.trim()) {
      errors.push(`Row ${rowNumber}: itemName is required.`);
    }

    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`Row ${rowNumber}: price must be a number higher than 0.`);
    }

    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      errors.push(`Row ${rowNumber}: stockQuantity must be 0 or higher.`);
    }

    if (!Number.isFinite(reorderLevel) || reorderLevel <= 0) {
      errors.push(`Row ${rowNumber}: reorderLevel must be higher than 0.`);
    }

    if (!row.pickupAddress.trim()) {
      errors.push(`Row ${rowNumber}: pickupAddress is required.`);
    }

    if (!row.shortDescription.trim()) {
      errors.push(`Row ${rowNumber}: shortDescription is required.`);
    }

    parsedRows.push({ ...row, rowNumber });
    return parsedRows;
  }, []);

  return { rows, errors };
}

function createEditDraft(listing: Business): ListingEditDraft {
  return {
    name: listing.name,
    description: listing.description,
    longDescription: listing.longDescription,
    category: listing.category,
    address: listing.address,
    price: String(listing.price ?? ''),
    stockQuantity: String(listing.stockQuantity ?? 0),
    reorderLevel: String(listing.reorderLevel ?? 1),
  };
}

function normalizeKey(value?: string | null) {
  return value?.trim().toLowerCase();
}

function normalizeProductIdentity(value?: string | null) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getListingIdentifier(listing: Business) {
  const serviceIdentifier = listing.services
    .find((service) => /^code:/i.test(service.trim()))
    ?.replace(/^code:\s*/i, '');
  const longDescriptionMatch = listing.longDescription.match(/Identifier:\s*([^\n]+)/i);

  return listing.sku ?? serviceIdentifier ?? longDescriptionMatch?.[1] ?? '';
}

function getOwnedOrderItems(order: Order, ownerKeys: string[]) {
  return order.items.filter((item) =>
    [item.ownerUserId, item.ownerName]
      .map(normalizeKey)
      .some((key) => Boolean(key && ownerKeys.includes(key))),
  );
}

function getOwnedOrderTotal(order: Order, ownerKeys: string[]) {
  return getOwnedOrderItems(order, ownerKeys).reduce((total, item) => total + item.lineTotal, 0);
}

function escapeReceiptHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function businessPublicStatus(business: Business) {
  if (business.verified && business.riverParkVerified) {
    return 'Live';
  }

  if (business.subscriptionStatus === 'paid' || business.subscriptionStatus === 'active') {
    return 'In review';
  }

  return 'Setup needed';
}

function buildProfileValues(userName: string, userEmail: string): OwnerBusinessProfileValues {
  return {
    ownerName: userName,
    phone: '',
    whatsapp: '',
    email: userEmail,
    website: '',
    instagram: '',
    address: '',
    coverImage: '',
    galleryImages: '',
    galleryVideos: '',
  };
}


type ResolvedPayoutAccount = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  verifiedAt: string;
};

function getRecordValue(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];

  return typeof value === 'string' ? value.trim() : '';
}

function normalizeVerifiedPayoutAccount(
  response: unknown,
  selectedBank: FlutterwaveBank,
  accountNumber: string,
): ResolvedPayoutAccount {
  const root = response && typeof response === 'object' ? response as Record<string, unknown> : undefined;
  const data = root?.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : undefined;

  const accountName =
    getRecordValue(root, 'accountName') ||
    getRecordValue(root, 'account_name') ||
    getRecordValue(data, 'accountName') ||
    getRecordValue(data, 'account_name');

  if (!accountName) {
    throw new Error('Flutterwave did not return an account name for this bank account. Please confirm the bank and account number.');
  }

  return {
    bankCode: getRecordValue(root, 'bankCode') || getRecordValue(root, 'account_bank') || selectedBank.code,
    bankName: getRecordValue(root, 'bankName') || selectedBank.name,
    accountNumber:
      getRecordValue(root, 'accountNumber') ||
      getRecordValue(root, 'account_number') ||
      getRecordValue(data, 'account_number') ||
      accountNumber,
    accountName,
    verifiedAt: getRecordValue(root, 'verifiedAt') || new Date().toISOString(),
  };
}

export function StoreOwnerDashboardScreen() {
  const {
    changePassword,
    signOut,
    supabaseAccessToken,
    updateUserSecurityPreference,
    user,
    userSecurityPreference,
  } = useAuth();
  const {
    businesses,
    centralCatalogProducts,
    currentEstateId,
    deleteOwnedBusinessListing,
    getNotificationsForUser,
    getOrdersForOwner,
    getOwnerBusinessProfile,
    hasCatalogManagementAccess,
    getVirtualAccountForOwner,
    getWithdrawalsForOwner,
    isBusinessOwnedByUser,
    isSubscriptionExemptForUser,
    markNotificationsRead,
    registerBusiness,
    requestWithdrawal,
    setVerifiedSellerPayoutAccount,
    setCatalogManagementAccess,
    updateBusinessListing,
    updateOwnerBusinessProfile,
    verifyOwnerVirtualAccount,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 820;
  const [activePage, setActivePage] = useState<SellerPortalPage>(getInitialSellerPortalPage);
  const [showSellerWelcome, setShowSellerWelcome] = useState(() => {
    if (Platform.OS !== 'web') {
      return false;
    }

    return new URLSearchParams(
      (globalThis as { location?: { search?: string } }).location?.search ?? '',
    ).get('welcome') === '1';
  });
  const [welcomePlan] = useState(() => {
    if (Platform.OS !== 'web') {
      return 'selected plan';
    }

    try {
      return globalThis.localStorage?.getItem('view2connect.sellerWelcomePlan') ?? 'selected plan';
    } catch {
      return 'selected plan';
    }
  });
  const [draft, setDraft] = useState<ProductDraft>(() => initialDraft(user?.fullName));
  const [errors, setErrors] = useState<Partial<Record<keyof ProductDraft, string>>>({});
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ListingEditDraft | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [payoutBankListError, setPayoutBankListError] = useState<string | null>(null);
  const [payoutBankError, setPayoutBankError] = useState<string | null>(null);
  const [payoutBanks, setPayoutBanks] = useState<FlutterwaveBank[]>([]);
  const [payoutBankSearch, setPayoutBankSearch] = useState('');
  const [selectedPayoutBankCode, setSelectedPayoutBankCode] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [resolvedPayoutAccount, setResolvedPayoutAccount] = useState<ResolvedPayoutAccount | null>(null);
  const [isLoadingPayoutBanks, setIsLoadingPayoutBanks] = useState(false);
  const [payoutBanksRequested, setPayoutBanksRequested] = useState(false);
  const [isVerifyingPayoutAccount, setIsVerifyingPayoutAccount] = useState(false);
  const [isSavingPayoutAccount, setIsSavingPayoutAccount] = useState(false);
  const [cacNumber, setCacNumber] = useState('');
  const [cacBusinessName, setCacBusinessName] = useState('');
  const [cacError, setCacError] = useState<string | null>(null);
  const [isVerifyingCac, setIsVerifyingCac] = useState(false);
  const [kycType, setKycType] = useState<WithdrawalKycType>('bvn');
  const [kycNumber, setKycNumber] = useState('');
  const [idDocumentUri, setIdDocumentUri] = useState('');
  const [idDocumentName, setIdDocumentName] = useState('');
  const [draftImageUri, setDraftImageUri] = useState('');
  const [draftImageName, setDraftImageName] = useState('');
  const [draftImageError, setDraftImageError] = useState<string | null>(null);
  const [isVerifyingKyc, setIsVerifyingKyc] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!showSellerWelcome || Platform.OS !== 'web') {
      return;
    }

    try {
      const browserWindow = globalThis as {
        history?: { replaceState: (state: unknown, title: string, url: string) => void };
        location?: { pathname?: string };
        localStorage?: { removeItem: (key: string) => void };
      };
      browserWindow.history?.replaceState(
        null,
        '',
        browserWindow.location?.pathname || '/seller-portal/',
      );
      browserWindow.localStorage?.removeItem('view2connect.sellerWelcomePlan');
    } catch {
      // The welcome dialog still works when browser storage is unavailable.
    }
  }, [showSellerWelcome]);

  const ownerProfile = getOwnerBusinessProfile(user);
  const sellerNotifications = getNotificationsForUser(user);
  const unreadSellerNotificationCount = sellerNotifications.filter(
    (notification) => !notification.readAt,
  ).length;
  const catalogAccessGranted = Boolean(user && hasCatalogManagementAccess(user.id));
  const normalizedPayoutBankSearch = payoutBankSearch.trim().toLowerCase();
  const selectedPayoutBank =
    payoutBanks.find((bank) => bank.code === selectedPayoutBankCode) ??
    (normalizedPayoutBankSearch
      ? payoutBanks.find((bank) => bank.name.toLowerCase() === normalizedPayoutBankSearch)
      : undefined);
  const visiblePayoutBanks = payoutBanks
    .filter((bank) =>
      normalizedPayoutBankSearch
        ? bank.name.toLowerCase().includes(normalizedPayoutBankSearch)
        : true,
    )
    .slice(0, 3);
  const payoutAccountVerified = Boolean(
    ownerProfile?.payoutBankCode &&
      ownerProfile.payoutAccountNumber &&
      ownerProfile.payoutAccountName &&
      ownerProfile.payoutVerifiedAt,
  );
  const [profileDraft, setProfileDraft] = useState<OwnerBusinessProfileValues>(() =>
    buildProfileValues(user?.businessName ?? user?.fullName ?? '', user?.email ?? ''),
  );

  const formatPayoutBankError = useCallback((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unable to load banks right now.';
    const normalized = message.toLowerCase();

    console.error('Flutterwave bank flow error:', error);

    if (
      normalized.includes('secret key') ||
      normalized.includes('credentials') ||
      normalized.includes('not configured')
    ) {
      return 'Bank list could not be loaded because Flutterwave secret key or backend configuration is missing.';
    }

    if (
      normalized.includes('failed to fetch') ||
      normalized.includes('network') ||
      normalized.includes('load banks')
    ) {
      return 'Unable to load banks. Please check your connection or try again.';
    }

    if (
      normalized.includes('flutterwave') ||
      normalized.includes('nigerian banks') ||
      normalized.includes('api')
    ) {
      return 'Bank list could not be loaded because Flutterwave API is not responding.';
    }

    return message;
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const source = ownerProfile ?? buildProfileValues(user.businessName ?? user.fullName, user.email);
    setProfileDraft({
      ownerName: source.ownerName,
      phone: source.phone || user.phoneNumber,
      whatsapp: source.whatsapp || user.phoneNumber,
      email: source.email || user.email,
      website: '',
      instagram: '',
      address: source.address ?? '',
      coverImage: source.coverImage ?? '',
      galleryImages: '',
      galleryVideos: '',
    });
  }, [ownerProfile, user]);

  useEffect(() => {
    if (!ownerProfile?.payoutBankCode || !ownerProfile.payoutBankName) {
      return;
    }

    setSelectedPayoutBankCode((current) => current || ownerProfile.payoutBankCode || '');
    setPayoutBankSearch((current) => current || ownerProfile.payoutBankName || '');
  }, [ownerProfile?.payoutBankCode, ownerProfile?.payoutBankName]);

  const loadPayoutBanks = useCallback(async () => {
    if (!supabaseAccessToken) {
      setPayoutBankListError('Sign in again before loading banks.');
      return;
    }

    try {
      setIsLoadingPayoutBanks(true);
      setPayoutBanksRequested(true);
      setPayoutBankListError(null);
      const banks = await fetchFlutterwaveNigerianBanks(supabaseAccessToken);
      const sortedBanks = [...banks].sort((left, right) => left.name.localeCompare(right.name));
      setPayoutBanks(sortedBanks);
    } catch (error) {
      setPayoutBanks([]);
      setPayoutBankListError(formatPayoutBankError(error));
    } finally {
      setIsLoadingPayoutBanks(false);
    }
  }, [formatPayoutBankError, supabaseAccessToken]);

  useEffect(() => {
    if (
      activePage !== 'payments' ||
      payoutBanks.length > 0 ||
      isLoadingPayoutBanks ||
      payoutBanksRequested
    ) {
      return;
    }

    void loadPayoutBanks();
  }, [
    activePage,
    isLoadingPayoutBanks,
    loadPayoutBanks,
    payoutBanks.length,
    payoutBanksRequested,
  ]);


  const clearPayoutVerification = () => {
    setResolvedPayoutAccount(null);
    setPayoutBankError(null);
  };

  const handlePayoutAccountNumberChange = (value: string) => {
    setPayoutAccountNumber(value.replace(/[^\d]/g, '').slice(0, 10));
    clearPayoutVerification();
  };

  const handlePayoutBankSearchChange = (value: string) => {
    setPayoutBankSearch(value);
    setSelectedPayoutBankCode('');
    clearPayoutVerification();
  };

  const selectPayoutBank = (bank: FlutterwaveBank) => {
    setSelectedPayoutBankCode(bank.code);
    setPayoutBankSearch(bank.name);
    clearPayoutVerification();
  };

  const clearSelectedPayoutBank = () => {
    setSelectedPayoutBankCode('');
    setPayoutBankSearch('');
    clearPayoutVerification();
  };

  const ownerKeys = useMemo(
    () =>
      [user?.id, user?.email, user?.fullName, user?.businessName]
        .map(normalizeKey)
        .filter((value): value is string => Boolean(value)),
    [user?.businessName, user?.email, user?.fullName, user?.id],
  );

  const ownerListings = useMemo(
    () =>
      user
        ? businesses
            .filter((business) => isBusinessOwnedByUser(business, user))
            .sort(
              (left, right) =>
                new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
            )
        : [],
    [businesses, isBusinessOwnedByUser, user],
  );

  const ownerOrders = useMemo(
    () => (user ? getOrdersForOwner(user.id, user) : []),
    [getOrdersForOwner, user],
  );

  const withdrawals = useMemo(
    () => (user ? getWithdrawalsForOwner(user.id) : []),
    [getWithdrawalsForOwner, user],
  );

  const virtualAccount = user ? getVirtualAccountForOwner(user.id) : undefined;
  const withdrawalVerified = Boolean(
    virtualAccount?.status === 'verified' &&
      virtualAccount.kycType &&
      virtualAccount.kycLast4 &&
      virtualAccount.kycReference &&
      virtualAccount.idDocumentUri,
  );
  const isSubscriptionExempt = isSubscriptionExemptForUser(user);
  const liveListings = ownerListings.filter((listing) => businessPublicStatus(listing) === 'Live');
  const pendingListings = ownerListings.filter((listing) => businessPublicStatus(listing) !== 'Live');
  const lowStockListings = ownerListings.filter(
    (listing) =>
      listing.listingType === 'product' &&
      (listing.stockQuantity ?? 0) <= Math.max(1, listing.reorderLevel ?? 1),
  );
  const totalStock = ownerListings.reduce(
    (total, listing) => total + Math.max(0, listing.stockQuantity ?? 0),
    0,
  );
  const paidSellerTotal = ownerOrders.reduce(
    (total, order) =>
      total +
      (order.paymentStatus === 'paid' && order.status !== 'cancelled'
        ? getOwnedOrderTotal(order, ownerKeys)
        : 0),
    0,
  );
  const deliveredSellerTotal = ownerOrders.reduce(
    (total, order) =>
      total +
      (order.paymentStatus === 'paid' && order.status === 'delivered'
        ? getOwnedOrderTotal(order, ownerKeys)
        : 0),
    0,
  );
  const withdrawnTotal = withdrawals.reduce((total, withdrawal) => total + withdrawal.amount, 0);
  const availableToWithdraw = Math.max(0, deliveredSellerTotal - withdrawnTotal);
  const pendingSellerTotal = Math.max(0, paidSellerTotal - deliveredSellerTotal);
  const activeEditListing = ownerListings.find((listing) => listing.id === editingListingId);

  const updateDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  };

  const validateDraft = () => {
    const nextErrors: Partial<Record<keyof ProductDraft, string>> = {};
    const price = Number.parseFloat(draft.price);
    const stockQuantity = Number.parseInt(draft.stockQuantity, 10);
    const reorderLevel = Number.parseInt(draft.reorderLevel, 10);

    if (!draft.itemName.trim()) {
      nextErrors.itemName = 'Item name is required.';
    }
    if (!draft.shortDescription.trim()) {
      nextErrors.shortDescription = 'Short description is required.';
    }
    if (!draft.pickupAddress.trim()) {
      nextErrors.pickupAddress = 'Pickup address is required.';
    }
    if (!draft.price.trim() || !Number.isFinite(price) || price <= 0) {
      nextErrors.price = 'Enter a valid price.';
    }
    if (!draft.stockQuantity.trim() || !Number.isFinite(stockQuantity) || stockQuantity < 0) {
      nextErrors.stockQuantity = 'Enter valid stock.';
    }
    if (!draft.reorderLevel.trim() || !Number.isFinite(reorderLevel) || reorderLevel <= 0) {
      nextErrors.reorderLevel = 'Enter a valid reorder level.';
    }
    if (draft.hasBarcode && !draft.identifier.trim()) {
      nextErrors.identifier = 'Enter the barcode, NAFDAC number, or SKU, or choose No.';
    }
    if (draft.hasSize && !draft.size.trim()) {
      nextErrors.size = 'Enter the size or pack measurement, or choose No.';
    }

    return nextErrors;
  };

  const persistPickedMediaUri = async (
    uri: string,
    scope: 'product' | 'identity',
    fallbackName: string,
  ) => {
    if (!uri || !isSupabaseConfigured || /^https?:\/\//i.test(uri)) {
      return uri;
    }

    const safeName = fallbackName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `${scope}-${Date.now()}`;
    const path = ['seller-media', user?.id ?? 'owner', scope, `${safeName}-${Date.now()}`].join('/');

    return uploadMediaUriToSupabaseStorage(uri, path, 'image');
  };

  const createBusinessValuesFromProduct = async (
    product: ProductDraft,
    productImageUri?: string,
  ): Promise<BusinessProfileFormValues> => {
    const itemName = product.itemName.trim();
    const identifierLine = product.hasBarcode && product.identifier.trim()
      ? `\n\nIdentifier: ${product.identifier.trim()}`
      : '';
    const sizeLine = product.hasSize && product.size.trim() ? `\nSize: ${product.size.trim()}` : '';
    const areaLine = product.area.trim() ? `\nArea: ${product.area.trim()}` : '';
    const details = `${product.details.trim() || product.shortDescription.trim()}${identifierLine}${sizeLine}${areaLine}`;
    const normalizedIdentifier = normalizeProductIdentity(
      product.hasBarcode ? product.identifier : '',
    );
    const normalizedName = normalizeProductIdentity(product.itemName);
    const catalogMatch = centralCatalogProducts.find(
      (catalogProduct) =>
        (normalizedIdentifier &&
          normalizeProductIdentity(catalogProduct.sku ?? '') === normalizedIdentifier) ||
        normalizeProductIdentity(catalogProduct.name) === normalizedName,
    );
    const resolvedImageUrl =
      (productImageUri
        ? await persistPickedMediaUri(productImageUri, 'product', product.itemName || 'product-image')
        : '') ||
      catalogMatch?.imageUrl ||
      (await resolveProductImageUrl(product));

    return {
      listingType: 'product',
      businessName: itemName,
      ownerName: user?.fullName ?? '',
      estateId: currentEstateId,
      subscriptionCycle: 'monthly',
      cluster: user?.businessCluster ?? riverParkClusters[0],
      category: product.category,
      shortDescription: product.shortDescription.trim(),
      longDescription: details,
      price: product.price.trim(),
      stockQuantity: product.stockQuantity.trim(),
      reorderLevel: product.reorderLevel.trim(),
      phone: user?.phoneNumber ?? '',
      whatsapp: user?.phoneNumber ?? '',
      email: user?.email ?? '',
      website: '',
      instagram: '',
      address: product.pickupAddress.trim(),
      coverImage: resolvedImageUrl,
      galleryImages: '',
      galleryVideos: '',
      services: [
        product.category,
        product.hasBarcode && product.identifier.trim()
          ? `Code: ${product.identifier.trim()}`
          : '',
        product.hasSize && product.size.trim() ? `Size: ${product.size.trim()}` : '',
        product.area.trim() ? `Area: ${product.area.trim()}` : '',
      ]
        .filter(Boolean)
        .join(', '),
      foodAllergies: '',
      foodExtras: '',
      preparationTime: '',
      portionSize: '',
    };
  };

  const findMatchingListingForProduct = (
    product: ProductDraft,
    sourceListings = ownerListings,
  ) => {
    const productIdentifier = normalizeProductIdentity(product.identifier);
    const productName = normalizeProductIdentity(product.itemName);

    return sourceListings.find((listing) => {
      const listingIdentifier = normalizeProductIdentity(getListingIdentifier(listing));
      const listingName = normalizeProductIdentity(listing.name);

      return Boolean(
        (productIdentifier && listingIdentifier && productIdentifier === listingIdentifier) ||
          (productName && listingName && productName === listingName),
      );
    });
  };

  const saveImportedProduct = async (
    product: ProductDraft,
    sourceListings = ownerListings,
  ): Promise<{ listing: Business; status: 'created' | 'updated' }> => {
    if (!user) {
      throw new Error('Sign in as a store owner before importing products.');
    }

    const values = await createBusinessValuesFromProduct(product);
    const existingListing = findMatchingListingForProduct(product, sourceListings);

    if (!existingListing) {
      const listing = await registerBusiness(values, user);
      return { listing, status: 'created' };
    }

    const listing = updateBusinessListing(
      existingListing.id,
      {
        name: values.businessName,
        description: values.shortDescription,
        longDescription: values.longDescription,
        category: values.category,
        address: values.address,
        imageUrl: values.coverImage,
        services: values.services
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        sku: product.hasBarcode ? product.identifier : '',
        price: Number(values.price),
        stockQuantity: Number(values.stockQuantity),
        reorderLevel: Number(values.reorderLevel),
      },
      user,
    );

    return { listing, status: 'updated' };
  };

  const submitItem = async () => {
    if (!user || user.role !== 'businessOwner' || isSubmittingItem) {
      return;
    }

    const nextErrors = validateDraft();
    const nextImageError = draftImageUri.trim()
      ? null
      : 'Attach the real product image from your gallery before posting.';

    if (Object.keys(nextErrors).length > 0 || nextImageError) {
      setErrors(nextErrors);
      setDraftImageError(nextImageError);
      return;
    }

    try {
      setIsSubmittingItem(true);
      setDraftImageError(null);
      const values = await createBusinessValuesFromProduct(draft, draftImageUri);
      await registerBusiness(values, user);
      Alert.alert('Product added', 'The product has been added to your catalog for View2Connect review.');
      setDraft(initialDraft(user.fullName));
      setDraftImageUri('');
      setDraftImageName('');
      setDraftImageError(null);
      setErrors({});
    } catch (error) {
      Alert.alert(
        'Unable to submit item',
        error instanceof Error ? error.message : 'The item could not be submitted right now.',
      );
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const importProducts = async () => {
    if (!user || user.role !== 'businessOwner' || isImportingProducts) {
      return;
    }

    const parsed = parseProductImportText(importText);

    if (parsed.errors.length > 0) {
      setImportErrors(parsed.errors);
      setImportMessage(null);
      return;
    }

    try {
      setIsImportingProducts(true);
      setImportErrors([]);
      setImportMessage(null);
      let createdCount = 0;
      let updatedCount = 0;
      const importedListings = [...ownerListings];

      for (const product of parsed.rows) {
        const result = await saveImportedProduct(product, importedListings);
        const existingIndex = importedListings.findIndex((listing) => listing.id === result.listing.id);

        if (existingIndex >= 0) {
          importedListings[existingIndex] = result.listing;
        } else {
          importedListings.unshift(result.listing);
        }

        if (result.status === 'updated') {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }
      }

      setImportMessage(
        `${createdCount} product${createdCount === 1 ? '' : 's'} created, ${updatedCount} updated.`,
      );
      Alert.alert(
        'Products imported',
        `${createdCount} product${createdCount === 1 ? '' : 's'} created and ${updatedCount} updated.`,
      );
    } catch (error) {
      setImportErrors([
        error instanceof Error ? error.message : 'Unable to import products right now.',
      ]);
    } finally {
      setIsImportingProducts(false);
    }
  };

  const openImportFilePicker = () => {
    const documentRef = (globalThis as { document?: { createElement: (tagName: string) => any } }).document;
    const FileReaderRef = (globalThis as { FileReader?: any }).FileReader;

    if (!documentRef || !FileReaderRef) {
      setImportErrors(['File upload is available in the web seller portal. Paste CSV rows here on this device.']);
      return;
    }

    const input = documentRef.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,.pdf,text/csv,text/tab-separated-values,application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      setImportFileName(file.name);
      setImportErrors([]);
      setImportMessage(null);

      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        setImportErrors([
          'PDF upload is for review only right now. Export the product list from POS/Excel as CSV to auto-create products.',
        ]);
        return;
      }

      const reader = new FileReaderRef();
      reader.onload = () => {
        setImportText(String(reader.result ?? ''));
      };
      reader.onerror = () => {
        setImportErrors(['Unable to read this file. Export it as CSV and try again.']);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const startEditingListing = (listing: Business) => {
    setEditingListingId(listing.id);
    setEditDraft(createEditDraft(listing));
    setEditMessage(null);
  };

  const saveListingEdit = () => {
    if (!activeEditListing || !editDraft || !user) {
      return;
    }

    try {
      updateBusinessListing(
        activeEditListing.id,
        {
          name: editDraft.name,
          description: editDraft.description,
          longDescription: editDraft.longDescription,
          category: editDraft.category,
          address: editDraft.address,
          price: Number(editDraft.price),
          stockQuantity: Number(editDraft.stockQuantity),
          reorderLevel: Number(editDraft.reorderLevel),
        },
        user,
      );
      setEditMessage('Item saved.');
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : 'Unable to save item.');
    }
  };

  const closeItemEditor = () => {
    setEditingListingId(null);
    setEditDraft(null);
    setEditMessage(null);
  };

  const deleteListingNow = (listing: Business) => {
    try {
      deleteOwnedBusinessListing(listing.id, user);
      if (editingListingId === listing.id) {
        closeItemEditor();
      }
    } catch (error) {
      Alert.alert(
        'Unable to delete item',
        error instanceof Error ? error.message : 'This item could not be deleted.',
      );
    }
  };

  const confirmDeleteListing = (listing: Business) => {
    const message = `Delete ${listing.name}? This removes it from your seller inventory and marketplace review list.`;

    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (message: string) => boolean }).confirm;
      const confirmed = confirm ? confirm(`Delete item\n\n${message}`) : true;

      if (confirmed) {
        deleteListingNow(listing);
      }

      return;
    }

    Alert.alert('Delete item', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteListingNow(listing),
      },
    ]);
  };

  const verifyPayoutIdentity = async () => {
    if (!user || isVerifyingKyc) {
      return;
    }

    try {
      setIsVerifyingKyc(true);
      setPaymentError(null);
      const uploadedDocumentUri = await persistPickedMediaUri(idDocumentUri, 'identity', idDocumentName || 'id-document');
      await verifyOwnerVirtualAccount(user, {
        kycType,
        kycNumber,
        idDocumentUri: uploadedDocumentUri,
        idDocumentName,
      });
      setKycNumber('');
      setIdDocumentUri('');
      setIdDocumentName('');
      Alert.alert('Payment method verified', 'Your withdrawal identity has been verified.');
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : 'Unable to verify payment method right now.',
      );
    } finally {
      setIsVerifyingKyc(false);
    }
  };

  const verifyPayoutAccount = async () => {
    if (!user || !supabaseAccessToken) {
      setPayoutBankError('Sign in again before verifying this account.');
      return;
    }

    if (payoutAccountNumber.length !== 10) {
      setPayoutBankError('Enter a valid 10-digit account number.');
      return;
    }

    if (!selectedPayoutBank) {
      setPayoutBankError('Select the bank from the list before verifying the account.');
      return;
    }

    try {
      setIsVerifyingPayoutAccount(true);
      setPayoutBankError(null);
      const verifiedAccountResponse = await verifySellerPayoutAccount(supabaseAccessToken, {
        ownerUserId: user.id,
        bankCode: selectedPayoutBank.code,
        bankName: selectedPayoutBank.name,
        accountNumber: payoutAccountNumber,
      });
      const verifiedAccount = normalizeVerifiedPayoutAccount(
        verifiedAccountResponse,
        selectedPayoutBank,
        payoutAccountNumber,
      );
      setResolvedPayoutAccount(verifiedAccount);
      Alert.alert('Account verified', `${verifiedAccount.accountName} was confirmed by Flutterwave.`);
    } catch (error) {
      console.error('Flutterwave account verification failed:', error);
      setResolvedPayoutAccount(null);
      setPayoutBankError(
        error instanceof Error
          ? error.message
          : 'Flutterwave could not verify this bank account.',
      );
    } finally {
      setIsVerifyingPayoutAccount(false);
    }
  };

  const saveResolvedPayoutAccount = async () => {
    if (!user || !supabaseAccessToken || !resolvedPayoutAccount) {
      setPayoutBankError('Verify the account first before saving.');
      return;
    }

    try {
      setIsSavingPayoutAccount(true);
      setPayoutBankError(null);
      const savedAccount = await saveVerifiedSellerPayoutAccountToSupabase(supabaseAccessToken, {
        ownerUserId: user.id,
        ...resolvedPayoutAccount,
      });
      setVerifiedSellerPayoutAccount(user, savedAccount);
      setSelectedPayoutBankCode(savedAccount.bankCode);
      setPayoutBankSearch(savedAccount.bankName);
      setPayoutAccountNumber(savedAccount.accountNumber);
      setResolvedPayoutAccount(savedAccount);
      Alert.alert(
        'Bank account saved',
        `${savedAccount.accountName} was saved for seller payouts.`,
      );
    } catch (error) {
      setPayoutBankError(
        error instanceof Error
          ? error.message
          : 'Unable to save the verified bank account right now.',
      );
    } finally {
      setIsSavingPayoutAccount(false);
    }
  };

  const submitWithdrawal = () => {
    if (!user) {
      return;
    }

    try {
      if (
        !ownerProfile?.payoutBankName ||
        !ownerProfile.payoutAccountNumber ||
        !ownerProfile.payoutAccountName
      ) {
        throw new Error('Verify and save a payout bank account first.');
      }

      const withdrawal = requestWithdrawal(user, {
        amount: Number(withdrawalAmount.replace(/,/g, '')),
        bankName: ownerProfile.payoutBankName,
        accountNumber: ownerProfile.payoutAccountNumber,
        accountName: ownerProfile.payoutAccountName,
      });
      setWithdrawalAmount('');
      setPaymentError(null);
      Alert.alert('Withdrawal paid', `${formatCurrency(withdrawal.amount)} was withdrawn.`);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to withdraw right now.');
    }
  };

  const savePassword = async () => {
    if (nextPassword !== confirmPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      setSecurityError(null);
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setSecurityMessage('Password updated.');
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Unable to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const savePasscode = () => {
    const cleaned = passcode.replace(/\D/g, '').slice(0, 6);
    const cleanedConfirm = confirmPasscode.replace(/\D/g, '').slice(0, 6);

    if (cleaned.length < 4) {
      setSecurityError('Passcode must be 4 to 6 digits.');
      return;
    }

    if (cleaned !== cleanedConfirm) {
      setSecurityError('Passcodes do not match.');
      return;
    }

    updateUserSecurityPreference({ passcodeEnabled: true, passcode: cleaned });
    setPasscode('');
    setConfirmPasscode('');
    setSecurityError(null);
    setSecurityMessage('App passcode saved.');
  };

  const pickProfileMedia = async (
    field: 'coverImage' | 'galleryImages',
    mediaTypes: ImagePicker.MediaType[],
    allowsMultipleSelection: boolean,
  ) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow gallery access in your device settings so you can update business profile photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection,
      mediaTypes,
      quality: 1,
      selectionLimit: allowsMultipleSelection ? 0 : 1,
    });

    if (result.canceled) {
      return;
    }

    const nextUris = result.assets.map((asset) => asset.uri).filter(Boolean);

    if (nextUris.length === 0) {
      return;
    }

    if (field === 'coverImage') {
      setProfileDraft((current) => ({ ...current, coverImage: nextUris[0] ?? current.coverImage }));
      return;
    }

    setProfileDraft((current) => ({
      ...current,
      galleryImages: Array.from(new Set([...splitInputList(current.galleryImages), ...nextUris])).join(', '),
    }));
  };

  const pickProductImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow gallery access in your device settings so you can attach a product image.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setDraftImageUri(asset.uri);
    setDraftImageName(asset.fileName ?? `product-image-${Date.now()}.jpg`);
    setDraftImageError(null);
  };

  const pickIdDocument = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow gallery access in your device settings so you can upload your ID document.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.85,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setIdDocumentUri(asset.uri);
    setIdDocumentName(asset.fileName ?? `id-document-${Date.now()}.jpg`);
  };

  const saveProfile = async () => {
    if (!user) {
      return;
    }

    try {
      setIsSavingProfile(true);
      setProfileError(null);
      setProfileMessage(null);

      const uploadedCoverImage = await persistPickedMediaUri(
        profileDraft.coverImage.trim(),
        'identity',
        'store-cover',
      );
      const uploadedGalleryImages = await Promise.all(
        splitInputList(profileDraft.galleryImages).map((uri, index) =>
          persistPickedMediaUri(uri, 'identity', `gallery-image-${index + 1}`),
        ),
      );
      const nextProfileDraft: OwnerBusinessProfileValues = {
        ...profileDraft,
        coverImage: uploadedCoverImage,
        galleryImages: uploadedGalleryImages.join(', '),
      };

      setProfileDraft(nextProfileDraft);
      await updateOwnerBusinessProfile(user, nextProfileDraft, user.fullName, 'businessOwner');
      setProfileMessage('Profile saved. Your cover photo is now available to admin managed catalogs.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const verifyBusinessCac = async () => {
    if (!user || !supabaseAccessToken) {
      setCacError('Sign in again before verifying your CAC business number.');
      return;
    }

    const cleanCacNumber = cacNumber.trim().toUpperCase();

    if (!/^[A-Z0-9/-]{4,24}$/.test(cleanCacNumber)) {
      setCacError('Enter a valid CAC business number.');
      return;
    }

    try {
      setIsVerifyingCac(true);
      setCacError(null);
      const verifiedBusiness = await verifyCacBusinessRegistration(supabaseAccessToken, {
        ownerUserId: user.id,
        cacNumber: cleanCacNumber,
      });
      const nextProfileDraft = {
        ...profileDraft,
        ownerName: verifiedBusiness.businessName,
      };

      setCacNumber(verifiedBusiness.cacNumber);
      setCacBusinessName(verifiedBusiness.businessName);
      setProfileDraft(nextProfileDraft);
      await updateOwnerBusinessProfile(user, nextProfileDraft, user.fullName, 'businessOwner');
      setProfileError(null);
      setProfileMessage('Profile name updated from verified CAC business name.');
      Alert.alert(
        'CAC business verified',
        `${verifiedBusiness.businessName} was confirmed and added to your store profile.`,
      );
    } catch (error) {
      setCacBusinessName('');
      setCacError(
        error instanceof Error
          ? error.message
          : 'Unable to verify this CAC business number right now.',
      );
    } finally {
      setIsVerifyingCac(false);
    }
  };

  if (!user) {
    return null;
  }

  if (user.role !== 'businessOwner') {
    return (
      <View style={styles.accessShell}>
        <Ionicons color={colors.secondary} name="alert-circle-outline" size={34} />
        <Text style={styles.sectionTitle}>Store owner account required</Text>
        <Text style={styles.mutedText}>
          Sign in with a verified store owner account, then complete seller registration and admin review.
        </Text>
        <AppButton label="Sign out" onPress={signOut} variant="secondary" />
      </View>
    );
  }

  const renderStatCard = (
    label: string,
    value: string,
    icon: keyof typeof Ionicons.glyphMap,
    tone: 'primary' | 'secondary' = 'primary',
  ) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, tone === 'secondary' && styles.statIconSecondary]}>
        <Ionicons color={tone === 'secondary' ? colors.secondary : colors.primary} name={icon} size={20} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const printSellerReceipt = (order: Order, ownedItems: OrderItem[]) => {
    const sellerTotal = ownedItems.reduce((total, item) => total + item.lineTotal, 0);
    const sellerName = ownerProfile?.accountName ?? user.businessName ?? user.fullName;
    const receiptLines = [
      `Seller receipt: ${order.id}`,
      `Store: ${sellerName}`,
      `Customer: ${order.userName}`,
      `Date: ${formatDateTime(order.createdAt)}`,
      `Delivery: ${order.deliveryAddress}`,
      `Payment: ${order.paymentStatus}`,
      '',
      ...ownedItems.map(
        (item) =>
          `${item.businessName} - ${formatNumber(item.quantity)} x ${formatCurrency(
            item.unitPrice,
          )} = ${formatCurrency(item.lineTotal)}`,
      ),
      '',
      `Seller total: ${formatCurrency(sellerTotal)}`,
    ];

    if (Platform.OS === 'web') {
      const browserWindow = globalThis as unknown as {
        open?: (
          url?: string,
          target?: string,
          features?: string,
        ) => {
          document?: {
            write: (html: string) => void;
            close: () => void;
          };
          focus?: () => void;
          print?: () => void;
        } | null;
      };
      const receiptWindow = browserWindow.open?.('', '_blank', 'width=420,height=680');

      if (receiptWindow?.document) {
        const rows = ownedItems
          .map(
            (item) => `
              <tr>
                <td>${escapeReceiptHtml(item.businessName)}</td>
                <td>${escapeReceiptHtml(item.quantity)}</td>
                <td>${escapeReceiptHtml(formatCurrency(item.unitPrice))}</td>
                <td>${escapeReceiptHtml(formatCurrency(item.lineTotal))}</td>
              </tr>`,
          )
          .join('');
        receiptWindow.document.write(`
          <!doctype html>
          <html>
            <head>
              <title>${escapeReceiptHtml(order.id)} receipt</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                h1 { font-size: 20px; margin: 0 0 8px; }
                p { margin: 4px 0; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border-bottom: 1px solid #E5E7EB; padding: 8px 4px; text-align: left; font-size: 12px; }
                .total { margin-top: 16px; font-weight: 700; font-size: 15px; }
              </style>
            </head>
            <body>
              <h1>Seller receipt</h1>
              <p><strong>Order:</strong> ${escapeReceiptHtml(order.id)}</p>
              <p><strong>Store:</strong> ${escapeReceiptHtml(sellerName)}</p>
              <p><strong>Customer:</strong> ${escapeReceiptHtml(order.userName)}</p>
              <p><strong>Date:</strong> ${escapeReceiptHtml(formatDateTime(order.createdAt))}</p>
              <p><strong>Delivery:</strong> ${escapeReceiptHtml(order.deliveryAddress)}</p>
              <p><strong>Payment:</strong> ${escapeReceiptHtml(order.paymentStatus)}</p>
              <table>
                <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
              <p class="total">Seller total: ${escapeReceiptHtml(formatCurrency(sellerTotal))}</p>
            </body>
          </html>
        `);
        receiptWindow.document.close();
        receiptWindow.focus?.();
        receiptWindow.print?.();
        return;
      }
    }

    Alert.alert('Seller receipt', receiptLines.join('\n'));
  };

  const renderOrderCard = (order: Order) => {
    const ownedItems = getOwnedOrderItems(order, ownerKeys);

    return (
      <View key={order.id} style={styles.listCard}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.itemTitle}>{order.id}</Text>
            <Text style={styles.mutedText}>
              {order.userName} - {formatDateTime(order.createdAt)}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{getOrderStatusLabel(order.status)}</Text>
          </View>
        </View>
        <View style={styles.itemList}>
          {ownedItems.map((item: OrderItem) => (
            <View key={`${order.id}-${item.businessId}`} style={styles.orderItemRow}>
              <Text style={styles.orderItemName}>{item.businessName}</Text>
              <Text style={styles.mutedText}>
                {formatNumber(item.quantity)} x {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={styles.orderAmount}>{formatCurrency(item.lineTotal)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.mutedText}>
          Delivery: {order.deliveryAddress} - Payment: {order.paymentStatus}
        </Text>
        <AppButton
          label="Receipt"
          onPress={() => printSellerReceipt(order, ownedItems)}
          style={styles.receiptButton}
          variant="ghost"
        />
      </View>
    );
  };

  const renderSellerNotifications = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.mutedText}>
            {unreadSellerNotificationCount > 0
              ? `${formatNumber(unreadSellerNotificationCount)} unread alert${unreadSellerNotificationCount > 1 ? 's' : ''}`
              : 'Order and catalog alerts appear here.'}
          </Text>
        </View>
        {sellerNotifications.length > 0 ? (
          <AppButton
            label="Mark read"
            onPress={() => markNotificationsRead(user.id)}
            variant="ghost"
          />
        ) : null}
      </View>
      <View style={styles.itemList}>
        {sellerNotifications.slice(0, 4).map((notification) => (
          <View key={notification.id} style={styles.listCard}>
            <View style={styles.listHeader}>
              <Text style={styles.itemTitle}>{notification.title}</Text>
              {!notification.readAt ? (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>New</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.mutedText}>{notification.body}</Text>
            <Text style={styles.mutedText}>{formatDateTime(notification.createdAt)}</Text>
          </View>
        ))}
        {sellerNotifications.length === 0
          ? renderEmpty('No notifications yet', 'Order, payout, and listing alerts will show here.')
          : null}
      </View>
    </View>
  );

  const renderDashboard = () => (
    <View style={styles.pageStack}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Store owner portal</Text>
          <Text style={styles.heroTitle}>Run your shop without the customer app nav.</Text>
          <Text style={styles.heroText}>
            Post products, watch orders, prepare stock, manage payout details, and secure this
            seller account from one portal.
          </Text>
          {isUrbanConnectLocalTestMode ? (
            <Text style={styles.heroNotice}>Local test mode is on. Live Flutterwave and Supabase actions are disabled.</Text>
          ) : null}
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.metricValue}>{formatNumber(ownerListings.length)}</Text>
          <Text style={styles.metricLabel}>Catalog items</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        {renderStatCard('Live listings', formatNumber(liveListings.length), 'checkmark-circle-outline')}
        {renderStatCard('Review queue', formatNumber(pendingListings.length), 'time-outline')}
        {renderStatCard('Orders', formatNumber(ownerOrders.length), 'receipt-outline')}
        {renderStatCard('Available payout', formatCurrency(availableToWithdraw), 'wallet-outline', 'secondary')}
      </View>

      <View style={styles.workspaceGrid}>
        {renderSellerNotifications()}
      </View>

      <View style={styles.workspaceGrid}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Action center</Text>
            <Text style={styles.mutedText}>Fast seller tasks</Text>
          </View>
          <View style={styles.quickGrid}>
            <AppButton label="Post product" onPress={() => setActivePage('items')} />
            <AppButton label="View orders" onPress={() => setActivePage('orders')} variant="ghost" />
            <AppButton label="Payment method" onPress={() => setActivePage('payments')} variant="ghost" />
            <AppButton label="Security" onPress={() => setActivePage('security')} variant="ghost" />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Account status</Text>
            <Text style={styles.mutedText}>{isSubscriptionExempt ? 'Owner exempt' : 'Subscription tracked'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.rowTitle}>Listing approval</Text>
            <Text style={styles.rowValue}>{pendingListings.length > 0 ? 'Needs admin review' : 'No pending items'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.rowTitle}>Low stock</Text>
            <Text style={styles.rowValue}>{formatNumber(lowStockListings.length)} item(s)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.rowTitle}>Pending earnings</Text>
            <Text style={styles.rowValue}>{formatCurrency(pendingSellerTotal)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Recent orders</Text>
          <Pressable onPress={() => setActivePage('orders')} style={styles.textButton}>
            <Text style={styles.textButtonText}>Open orders</Text>
          </Pressable>
        </View>
        {ownerOrders.length > 0 ? ownerOrders.slice(0, 3).map(renderOrderCard) : renderEmpty('No orders yet', 'Orders appear after customers buy approved items.')}
      </View>
    </View>
  );

  const renderItemEditor = () => {
    if (!activeEditListing || !editDraft) {
      return null;
    }

    const identifier = getListingIdentifier(activeEditListing);

    return (
      <View style={styles.pageStack}>
        <View style={styles.panelFull}>
          <View style={styles.editorHeader}>
            <Pressable
              accessibilityRole="button"
              onPress={closeItemEditor}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.primary} name="chevron-back" size={20} />
              <Text style={styles.backButtonText}>Back to items</Text>
            </Pressable>
            <View style={styles.editorActions}>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{businessPublicStatus(activeEditListing)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDeleteListing(activeEditListing)}
                style={({ pressed }) => [styles.dangerIconButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.editorIntro}>
            <Image
              resizeMode="cover"
              source={{ uri: activeEditListing.imageUrl || fallbackProductImage }}
              style={styles.editHeroImage}
            />
            <View style={styles.editorIntroCopy}>
              <Text style={styles.eyebrow}>Editing product</Text>
              <Text style={styles.sectionTitle}>{activeEditListing.name}</Text>
              <Text style={styles.mutedText}>
                {identifier
                  ? `Barcode / NAFDAC / SKU: ${identifier}`
                  : 'No barcode, NAFDAC number, or SKU is saved for this item yet.'}
              </Text>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumnWide}>
              <FormField
                label="Name"
                onChangeText={(value) => setEditDraft({ ...editDraft, name: value })}
                value={editDraft.name}
              />
            </View>
            <View style={styles.formColumn}>
              <FormField
                keyboardType="numeric"
                label="Price"
                onChangeText={(value) =>
                  setEditDraft({ ...editDraft, price: value.replace(/[^\d.]/g, '') })
                }
                value={editDraft.price}
              />
            </View>
          </View>

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {productCategories.map((category) => {
              const isActive = editDraft.category === category;

              return (
                <Pressable
                  key={category}
                  onPress={() => setEditDraft({ ...editDraft, category })}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    isActive && styles.categoryChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <FormField
                keyboardType="numeric"
                label="Stock"
                onChangeText={(value) =>
                  setEditDraft({ ...editDraft, stockQuantity: value.replace(/[^\d]/g, '') })
                }
                value={editDraft.stockQuantity}
              />
            </View>
            <View style={styles.formColumn}>
              <FormField
                keyboardType="numeric"
                label="Reorder level"
                onChangeText={(value) =>
                  setEditDraft({ ...editDraft, reorderLevel: value.replace(/[^\d]/g, '') })
                }
                value={editDraft.reorderLevel}
              />
            </View>
          </View>

          <FormField
            label="Short description"
            onChangeText={(value) => setEditDraft({ ...editDraft, description: value })}
            value={editDraft.description}
          />
          <FormField
            label="Pickup address"
            onChangeText={(value) => setEditDraft({ ...editDraft, address: value })}
            value={editDraft.address}
          />
          <FormField
            label="Details"
            multiline
            onChangeText={(value) => setEditDraft({ ...editDraft, longDescription: value })}
            value={editDraft.longDescription}
          />

          {editMessage ? <Text style={styles.infoText}>{editMessage}</Text> : null}
          <View style={styles.buttonRow}>
            <AppButton label="Save item" onPress={saveListingEdit} style={styles.flexButton} />
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmDeleteListing(activeEditListing)}
              style={({ pressed }) => [styles.dangerButton, styles.flexButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.danger} name="trash-outline" size={18} />
              <Text style={styles.dangerButtonText}>Delete item</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderItems = () => {
    if (activeEditListing && editDraft) {
      return renderItemEditor();
    }

    const draftPreviewPrice = Number.parseFloat(draft.price);
    const hasDraftPreviewImage = Boolean(draftImageUri.trim());
    const previewDescription =
      draft.shortDescription.trim() ||
      draft.details.trim() ||
      'Description preview';

    return (
      <View style={styles.workspaceGrid}>
      <View style={styles.panelFull}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionTitle}>View2Connect central catalog</Text>
            <Text style={styles.mutedText}>
              Choose an owner-created product, then add your stock and pickup details.
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{centralCatalogProducts.length} products</Text>
          </View>
        </View>
        {centralCatalogProducts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.centralCatalogRow}>
              {centralCatalogProducts.map((catalogProduct) => (
                <View key={catalogProduct.id} style={styles.centralCatalogCard}>
                  <Image
                    resizeMode="contain"
                    source={{ uri: catalogProduct.imageUrl }}
                    style={styles.centralCatalogImage}
                  />
                  <Text numberOfLines={2} style={styles.rowTitle}>
                    {catalogProduct.name}
                  </Text>
                  <Text style={styles.mutedText}>{catalogProduct.category}</Text>
                  <Text style={styles.infoText}>{formatCurrency(catalogProduct.price)}</Text>
                  <AppButton
                    label="Use product"
                    onPress={() => {
                      const sizeTag = catalogProduct.tags.find((tag) =>
                        /^size:/i.test(tag.trim()),
                      );
                      const barcodeTag = catalogProduct.tags.find((tag) =>
                        /^barcode:/i.test(tag.trim()),
                      );
                      const barcode =
                        barcodeTag?.replace(/^barcode:\s*/i, '').trim() ??
                        (catalogProduct.sku?.startsWith('CAT-') ? '' : catalogProduct.sku ?? '');
                      const size = sizeTag?.replace(/^size:\s*/i, '').trim() ?? '';

                      setDraft((current) => ({
                        ...current,
                        itemName: catalogProduct.name,
                        category: catalogProduct.category,
                        hasBarcode: Boolean(barcode),
                        identifier: barcode,
                        hasSize: Boolean(size),
                        size,
                        price: String(catalogProduct.price || ''),
                        shortDescription: catalogProduct.description,
                        details: '',
                      }));
                      setDraftImageUri(catalogProduct.imageUrl);
                      setDraftImageName(catalogProduct.name);
                      setDraftImageError(null);
                      setErrors({});
                    }}
                    variant="secondary"
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>The owner catalog is being prepared.</Text>
            <Text style={styles.mutedText}>
              You can still post manually. Owner-created products will appear here automatically.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.panelFull}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionTitle}>Import products</Text>
            <Text style={styles.mutedText}>
              Paste CSV text or rows copied from Excel. New products are created, and matching
              barcode/NAFDAC/SKU or product names update the existing item instead.
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>CSV / Excel</Text>
          </View>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.rowTitle}>Required columns</Text>
          <Text style={styles.mutedText}>
            itemName, price, stockQuantity, pickupAddress, shortDescription. Optional columns:
            category, reorderLevel, barcode/NAFDAC/SKU, size, area, details.
          </Text>
          <Text style={styles.mutedText}>
            Images are automatic: barcode match first, product-name match second, category image
            fallback last.
          </Text>
        </View>
        <FormField
          helper="Tip: open sample-data/seller-product-import.csv in Excel, edit it, then copy the rows back here."
          label="CSV or Excel rows"
          multiline
          onChangeText={(value) => {
            setImportText(value);
            setImportErrors([]);
            setImportMessage(null);
          }}
          placeholder={sampleProductImportCsv}
          value={importText}
        />
        {importErrors.length > 0 ? (
          <View style={styles.errorBox}>
            {importErrors.slice(0, 5).map((error) => (
              <Text key={error} style={styles.errorText}>
                {error}
              </Text>
            ))}
            {importErrors.length > 5 ? (
              <Text style={styles.errorText}>{importErrors.length - 5} more error(s).</Text>
            ) : null}
          </View>
        ) : null}
        {importMessage ? <Text style={styles.successText}>{importMessage}</Text> : null}
        {importFileName ? <Text style={styles.infoText}>Selected file: {importFileName}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            onPress={openImportFilePicker}
            style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.primary} name="cloud-upload-outline" size={20} />
            <Text style={styles.uploadButtonText}>Upload CSV/PDF</Text>
          </Pressable>
          <AppButton
            label="Load sample CSV"
            onPress={() => {
              setImportText(sampleProductImportCsv);
              setImportFileName(null);
              setImportErrors([]);
              setImportMessage(null);
            }}
            style={styles.flexButton}
            variant="ghost"
          />
          <AppButton
            label="Import products"
            loading={isImportingProducts}
            onPress={() => void importProducts()}
            style={styles.flexButton}
          />
        </View>
      </View>

      <View style={styles.panelWide}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Post product</Text>
          <Text style={styles.mutedText}>Add one product at a time</Text>
        </View>
        <FormField error={errors.itemName} label="Item name" onChangeText={(value) => updateDraft('itemName', value)} placeholder="Indomie Onion Chicken 70g" value={draft.itemName} />
        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <FormField error={errors.price} keyboardType="numeric" label="Price" onChangeText={(value) => updateDraft('price', value.replace(/[^\d.]/g, ''))} placeholder="1200" value={draft.price} />
          </View>
          <View style={styles.formColumn}>
            <FormField error={errors.stockQuantity} keyboardType="numeric" label="Stock" onChangeText={(value) => updateDraft('stockQuantity', value.replace(/[^\d]/g, ''))} placeholder="4" value={draft.stockQuantity} />
          </View>
          <View style={styles.formColumn}>
            <FormField error={errors.reorderLevel} keyboardType="numeric" label="Reorder level" onChangeText={(value) => updateDraft('reorderLevel', value.replace(/[^\d]/g, ''))} placeholder="1" value={draft.reorderLevel} />
          </View>
        </View>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {productCategories.map((category) => {
            const isActive = draft.category === category;

            return (
              <Pressable
                key={category}
                onPress={() => updateDraft('category', category)}
                style={({ pressed }) => [
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FormField error={errors.shortDescription} label="Short description" onChangeText={(value) => updateDraft('shortDescription', value)} placeholder="Small pack available for quick delivery" value={draft.shortDescription} />
        <Text style={styles.label}>Does this item have a barcode, NAFDAC number, or SKU?</Text>
        <View style={styles.categoryGrid}>
          {[
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ].map((option) => {
            const isActive = draft.hasBarcode === option.value;

            return (
              <Pressable
                key={`barcode-${option.label}`}
                onPress={() => {
                  updateDraft('hasBarcode', option.value);
                  if (!option.value) {
                    updateDraft('identifier', '');
                  }
                }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {draft.hasBarcode ? (
          <FormField
            error={errors.identifier}
            label="Barcode, NAFDAC number, or SKU"
            onChangeText={(value) => updateDraft('identifier', value)}
            placeholder="Enter the number or code"
            value={draft.identifier}
          />
        ) : null}
        <Text style={styles.label}>Does this item have a size or pack measurement?</Text>
        <View style={styles.categoryGrid}>
          {[
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ].map((option) => {
            const isActive = draft.hasSize === option.value;

            return (
              <Pressable
                key={`size-${option.label}`}
                onPress={() => {
                  updateDraft('hasSize', option.value);
                  if (!option.value) {
                    updateDraft('size', '');
                  }
                }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {draft.hasSize ? (
          <FormField
            error={errors.size}
            label="Size or pack measurement"
            onChangeText={(value) => updateDraft('size', value)}
            placeholder="50cl, 500ml, medium, pack of 6"
            value={draft.size}
          />
        ) : null}
        <View style={styles.infoBox}>
          <Text style={styles.rowTitle}>Product image</Text>
          <Text style={styles.mutedText}>
            Attach the real item photo from your gallery. Manual posts cannot be submitted
            without a product image.
          </Text>
        </View>
        <MediaPickerField
          assets={
            draftImageUri
              ? [{ label: assetLabelFromUri(draftImageUri, 'Product image', 0), uri: draftImageUri }]
              : []
          }
          buttonLabel={draftImageUri ? 'Change product image' : 'Attach product image'}
          helper="Required. Upload one product photo from your gallery."
          kind="image"
          label="Product image"
          onClear={() => {
            setDraftImageUri('');
            setDraftImageName('');
            setDraftImageError('Attach the real product image from your gallery before posting.');
          }}
          onPick={() => void pickProductImage()}
        />
        {draftImageError ? <Text style={styles.errorText}>{draftImageError}</Text> : null}
        <FormField error={errors.pickupAddress} label="Pickup address" onChangeText={(value) => updateDraft('pickupAddress', value)} placeholder="Shop, street, estate, or landmark" value={draft.pickupAddress} />
        <FormField label="Area" onChangeText={(value) => updateDraft('area', value)} placeholder="Gwarinpa, Wuse 2, Lekki Phase 1" value={draft.area} />
        <FormField label="Details" multiline onChangeText={(value) => updateDraft('details', value)} placeholder="Pack size, brand, freshness, preparation note, or pickup condition" value={draft.details} />
        <AppButton label="Add product to catalog" loading={isSubmittingItem} onPress={() => void submitItem()} />
      </View>

      <View style={styles.previewPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Live product preview</Text>
          <Text style={styles.mutedText}>Updates as you type</Text>
        </View>
        <View style={styles.marketplacePreviewCard}>
          {hasDraftPreviewImage ? (
            <Image
              resizeMode="cover"
              source={{ uri: draftImageUri }}
              style={styles.marketplacePreviewImage}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Ionicons color={colors.textMuted} name="image-outline" size={34} />
              <Text style={styles.previewPlaceholderTitle}>Product image preview</Text>
              <Text style={styles.previewPlaceholderText}>
                Attach a real product photo from your gallery to see it here.
              </Text>
            </View>
          )}
          <View style={styles.marketplacePreviewBody}>
            <Text style={styles.previewCategory}>{draft.category || 'Category preview'}</Text>
            <Text numberOfLines={2} style={styles.marketplacePreviewTitle}>
              {draft.itemName.trim() || 'Product name preview'}
            </Text>
            <Text style={styles.marketplacePreviewPrice}>
              {Number.isFinite(draftPreviewPrice) && draftPreviewPrice > 0
                ? formatCurrency(draftPreviewPrice)
                : 'Price preview'}
            </Text>
            <Text style={styles.marketplacePreviewDescription}>{previewDescription}</Text>
            <View style={styles.previewMetaRow}>
              <Text style={styles.previewMeta}>Stock {draft.stockQuantity || '0'}</Text>
              {draft.hasSize && draft.size.trim() ? (
                <Text style={styles.previewMeta}>{draft.size.trim()}</Text>
              ) : null}
              {draft.hasBarcode && draft.identifier.trim() ? (
                <Text style={styles.previewMeta}>Code {draft.identifier.trim()}</Text>
              ) : null}
              {draft.area.trim() ? <Text style={styles.previewMeta}>{draft.area.trim()}</Text> : null}
            </View>
            <View style={styles.previewInfoStack}>
              <Text style={styles.mutedText}>
                Pickup: {draft.pickupAddress.trim() || 'Pickup address preview'}
              </Text>
              <Text style={styles.mutedText}>
                Details: {draft.details.trim() || 'Extra product details appear here.'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.panelWide}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Product catalog</Text>
          <Text style={styles.mutedText}>{formatNumber(totalStock)} total stock</Text>
        </View>
        {ownerListings.length > 0 ? (
          ownerListings.map((listing) => (
            <View key={listing.id} style={styles.inventoryRow}>
              <Image resizeMode="cover" source={{ uri: listing.imageUrl || fallbackProductImage }} style={styles.inventoryImage} />
              <View style={styles.inventoryCopy}>
                <Text numberOfLines={1} style={styles.itemTitle}>{listing.name}</Text>
                <Text style={styles.mutedText}>{formatCurrency(listing.price)} - Stock {formatNumber(listing.stockQuantity ?? 0)}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{businessPublicStatus(listing)}</Text>
              </View>
              <Pressable onPress={() => startEditingListing(listing)} style={styles.iconButton}>
                <Ionicons color={colors.primary} name="create-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDeleteListing(listing)}
                style={({ pressed }) => [styles.dangerIconButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
              </Pressable>
            </View>
          ))
        ) : (
          renderEmpty('No items yet', 'Submit the first item from the form.')
        )}
      </View>
    </View>
    );
  };

  const renderOrders = () => (
    <View style={styles.pageStack}>
      <View style={styles.statsGrid}>
        {renderStatCard('All orders', formatNumber(ownerOrders.length), 'receipt-outline')}
        {renderStatCard('Paid seller total', formatCurrency(paidSellerTotal), 'cash-outline')}
        {renderStatCard('Pending delivery', formatCurrency(pendingSellerTotal), 'time-outline')}
        {renderStatCard('Delivered earnings', formatCurrency(deliveredSellerTotal), 'checkmark-done-outline', 'secondary')}
      </View>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Orders</Text>
          <Text style={styles.mutedText}>Each order shows only your items</Text>
        </View>
        {ownerOrders.length > 0 ? ownerOrders.map(renderOrderCard) : renderEmpty('No seller orders yet', 'Orders will appear here after customers buy your approved items.')}
      </View>
    </View>
  );

  const renderPayments = () => (
    <View style={styles.workspaceGrid}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Payment method</Text>
          <Text style={styles.mutedText}>{withdrawalVerified ? 'Verified' : 'Needs verification'}</Text>
        </View>
        <View style={styles.statsGrid}>
          {renderStatCard('Available', formatCurrency(availableToWithdraw), 'wallet-outline')}
          {renderStatCard('Withdrawn', formatCurrency(withdrawnTotal), 'arrow-up-circle-outline')}
        </View>
        <View style={styles.payoutFlowCard}>
          <View style={styles.payoutStepHeader}>
            <View style={styles.payoutStepBadge}>
              <Ionicons color={colors.primary} name="briefcase-outline" size={18} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.rowTitle}>CAC business verification</Text>
              <Text style={styles.mutedText}>
                Confirm your registered business name before saving payout details.
              </Text>
            </View>
          </View>
          <FormField
            autoCapitalize="characters"
            label="CAC business number"
            onChangeText={(value) => {
              setCacNumber(value.toUpperCase());
              setCacBusinessName('');
              setCacError(null);
            }}
            placeholder="RC123456 or BN123456"
            value={cacNumber}
          />
          <AppButton
            disabled={!supabaseAccessToken || cacNumber.trim().length < 4}
            label={isVerifyingCac ? 'Verifying CAC...' : 'Verify CAC business'}
            loading={isVerifyingCac}
            onPress={() => void verifyBusinessCac()}
          />
          {cacBusinessName ? (
            <View style={styles.verifiedAccountCard}>
              <Ionicons color={colors.success} name="shield-checkmark-outline" size={24} />
              <View style={styles.previewCopy}>
                <Text style={styles.mutedText}>Registered business name</Text>
                <Text style={styles.verifiedAccountName}>{cacBusinessName}</Text>
                <Text style={styles.mutedText}>Your store profile name has been updated.</Text>
              </View>
            </View>
          ) : null}
          {cacError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{cacError}</Text>
            </View>
          ) : null}
        </View>
        {payoutAccountVerified ? (
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>{ownerProfile?.payoutAccountName}</Text>
            <Text style={styles.mutedText}>
              {ownerProfile?.payoutBankName} - {ownerProfile?.payoutAccountNumber}
            </Text>
            <Text style={styles.mutedText}>
              Verified {formatDateTime(ownerProfile?.payoutVerifiedAt ?? '')}
            </Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>Add payout account</Text>
            <Text style={styles.mutedText}>
              Enter your account number, select your bank, verify the account name, then save it.
            </Text>
          </View>
        )}
        <View style={styles.payoutFlowCard}>
          <View style={styles.payoutStepHeader}>
            <View style={styles.payoutStepBadge}>
              <Ionicons color={colors.primary} name="business-outline" size={18} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.rowTitle}>Bank account</Text>
              <Text style={styles.mutedText}>Verify the real account name before saving payout details.</Text>
            </View>
          </View>

          <FormField
            keyboardType="numeric"
            label="Account number"
            onChangeText={handlePayoutAccountNumberChange}
            placeholder="Enter 10-digit account number"
            value={payoutAccountNumber}
          />

          <FormField
            label="Bank"
            onChangeText={handlePayoutBankSearchChange}
            placeholder={isLoadingPayoutBanks ? 'Loading banks...' : 'Search or select bank'}
            value={payoutBankSearch}
          />

          {isLoadingPayoutBanks ? <Text style={styles.mutedText}>Loading Nigerian banks...</Text> : null}

          {payoutBankListError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{payoutBankListError}</Text>
              <AppButton
                label="Retry loading banks"
                onPress={() => void loadPayoutBanks()}
                variant="secondary"
              />
            </View>

          ) : null}


          {!payoutBankListError && visiblePayoutBanks.length > 0 ? (
            <View style={styles.bankSearchResults}>
              {visiblePayoutBanks.map((bank) => {
                const isSelected = selectedPayoutBankCode === bank.code;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={`${bank.code}-${bank.name}`}
                    onPress={() => selectPayoutBank(bank)}
                    style={({ pressed }) => [
                      styles.bankOption,
                      isSelected && styles.bankOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.payoutStepBadge}>
                      <Ionicons
                        color={isSelected ? colors.primary : colors.textMuted}
                        name={isSelected ? 'checkmark-circle' : 'business-outline'}
                        size={18}
                      />
                    </View>
                    <View style={styles.previewCopy}>
                      <Text style={styles.bankOptionText}>{bank.name}</Text>
                      <Text style={styles.bankOptionSubtext}>Bank code: {bank.code}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : !payoutBankListError && payoutBanks.length > 0 && payoutBankSearch.trim() ? (
            <Text style={styles.mutedText}>
              No bank matched "{payoutBankSearch.trim()}". Try a shorter bank name.
            </Text>
          ) : null}

          {selectedPayoutBank ? (
            <View style={styles.selectedBankCard}>
              <Ionicons color={colors.success} name="checkmark-circle" size={22} />
              <View style={styles.previewCopy}>
                <Text style={styles.rowTitle}>{selectedPayoutBank.name}</Text>
                <Text style={styles.mutedText}>Selected bank for verification</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={clearSelectedPayoutBank} style={styles.textButton}>
                <Text style={styles.textButtonText}>Change</Text>
              </Pressable>
            </View>
          ) : null}

          {payoutBankError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{payoutBankError}</Text>
            </View>
          ) : null}

          {resolvedPayoutAccount ? (
            <View style={styles.verifiedAccountCard}>
              <Ionicons color={colors.success} name="shield-checkmark-outline" size={28} />
              <View style={styles.previewCopy}>
                <Text style={styles.mutedText}>Account name confirmed by Flutterwave</Text>
                <Text style={styles.verifiedAccountName}>{resolvedPayoutAccount.accountName}</Text>
                <Text style={styles.mutedText}>
                  {resolvedPayoutAccount.bankName} - {resolvedPayoutAccount.accountNumber}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.rowTitle}>Account name will appear here</Text>
              <Text style={styles.mutedText}>
                Enter 10 digits, select the bank from the list, then verify the account.
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <AppButton
              disabled={!supabaseAccessToken || !selectedPayoutBank || payoutAccountNumber.length !== 10}
              label={isVerifyingPayoutAccount ? 'Verifying account...' : 'Verify account'}
              loading={isVerifyingPayoutAccount}
              onPress={() => void verifyPayoutAccount()}
              style={styles.flexButton}
              variant="primary"
            />
            <AppButton
              disabled={!supabaseAccessToken || !resolvedPayoutAccount}
              label={isSavingPayoutAccount ? 'Saving payout account...' : 'Save payout account'}
              loading={isSavingPayoutAccount}
              onPress={() => void saveResolvedPayoutAccount()}
              style={styles.flexButton}
              variant="secondary"
            />
          </View>
        </View>
        {virtualAccount ? (
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>{virtualAccount.accountName}</Text>
            <Text style={styles.mutedText}>
              {virtualAccount.bankName} - {virtualAccount.accountNumber}
            </Text>
            <Text style={styles.mutedText}>
              {virtualAccount.kycReference ?? 'KYC not completed'}
            </Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.rowTitle}>No payout identity yet</Text>
            <Text style={styles.mutedText}>Verify BVN/NIN and upload ID before withdrawals.</Text>
          </View>
        )}
        <Text style={styles.label}>Verification type</Text>
        <View style={styles.categoryGrid}>
          {kycOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setKycType(option.value)}
              style={[styles.categoryChip, kycType === option.value && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, kycType === option.value && styles.categoryTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <FormField keyboardType="numeric" label="BVN or NIN number" onChangeText={(value) => setKycNumber(value.replace(/[^\d]/g, '').slice(0, 11))} placeholder="11 digits" value={kycNumber} />
        <MediaPickerField
          assets={
            idDocumentUri
              ? [{ label: assetLabelFromUri(idDocumentUri, 'ID document', 0), uri: idDocumentUri }]
              : []
          }
          buttonLabel={idDocumentUri ? 'Replace ID document' : 'Upload ID document'}
          helper="Upload a photo of your BVN, NIN, or national ID document."
          kind="image"
          label="ID document"
          onClear={() => {
            setIdDocumentUri('');
            setIdDocumentName('');
          }}
          onPick={() => void pickIdDocument()}
        />
        {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}
        <AppButton label="Verify payout identity" loading={isVerifyingKyc} onPress={() => void verifyPayoutIdentity()} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Withdraw</Text>
          <Text style={styles.mutedText}>Delivered earnings only</Text>
        </View>
        <FormField keyboardType="numeric" label="Amount" onChangeText={(value) => setWithdrawalAmount(value.replace(/[^\d.]/g, ''))} placeholder="5000" value={withdrawalAmount} />
        <View style={styles.infoBox}>
          <Text style={styles.rowTitle}>
            {ownerProfile?.payoutAccountName ?? 'No verified payout account'}
          </Text>
          <Text style={styles.mutedText}>
            {ownerProfile?.payoutBankName ?? 'Verify a bank account above'}
            {ownerProfile?.payoutAccountNumber
              ? ` - ${ownerProfile.payoutAccountNumber}`
              : ''}
          </Text>
        </View>
        <AppButton disabled={!withdrawalVerified || !payoutAccountVerified} label="Withdraw earnings" onPress={submitWithdrawal} />
        <View style={styles.itemList}>
          {withdrawals.length > 0 ? (
            withdrawals.slice(0, 6).map((withdrawal) => (
              <View key={withdrawal.id} style={styles.infoRow}>
                <Text style={styles.rowTitle}>{formatCurrency(withdrawal.amount)}</Text>
                <Text style={styles.rowValue}>{withdrawal.bankName} - {withdrawal.accountNumber}</Text>
              </View>
            ))
          ) : (
            renderEmpty('No withdrawals yet', 'Completed withdrawals will show here.')
          )}
        </View>
      </View>
    </View>
  );

  const renderSecurity = () => (
    <View style={styles.workspaceGrid}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Login password</Text>
          <Text style={styles.mutedText}>Seller portal access</Text>
        </View>
        <FormField label="Current password" onChangeText={setCurrentPassword} secureTextEntry value={currentPassword} />
        <FormField label="New password" onChangeText={setNextPassword} secureTextEntry value={nextPassword} />
        <FormField label="Confirm new password" onChangeText={setConfirmPassword} secureTextEntry value={confirmPassword} />
        <AppButton label="Change password" loading={isChangingPassword} onPress={() => void savePassword()} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>App passcode</Text>
          <Text style={styles.mutedText}>{userSecurityPreference.passcodeEnabled ? 'On' : 'Off'}</Text>
        </View>
        <FormField keyboardType="numeric" label="Passcode" onChangeText={(value) => setPasscode(value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="4 to 6 digits" secureTextEntry value={passcode} />
        <FormField keyboardType="numeric" label="Confirm passcode" onChangeText={(value) => setConfirmPasscode(value.replace(/[^\d]/g, '').slice(0, 6))} secureTextEntry value={confirmPasscode} />
        <View style={styles.buttonRow}>
          <AppButton label="Save passcode" onPress={savePasscode} style={styles.flexButton} />
          <AppButton
            label="Remove"
            onPress={() => {
              updateUserSecurityPreference({ passcodeEnabled: false, passcode: '' });
              setSecurityMessage('App passcode removed.');
            }}
            style={styles.flexButton}
            variant="ghost"
          />
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.rowTitle}>Biometric access</Text>
          <Text style={styles.mutedText}>
            Face ID or Touch ID is still controlled from the mobile app settings on the device.
          </Text>
        </View>
        {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
        {securityMessage ? <Text style={styles.successText}>{securityMessage}</Text> : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.mutedText}>Seller portal alerts</Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: userSecurityPreference.notificationsEnabled }}
          onPress={() => {
            updateUserSecurityPreference({
              notificationsEnabled: !userSecurityPreference.notificationsEnabled,
            });
            setSecurityMessage(
              userSecurityPreference.notificationsEnabled
                ? 'Notification popups turned off.'
                : 'Notification popups turned on.',
            );
          }}
          style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
        >
          <View>
            <Text style={styles.rowTitle}>In-app alert popups</Text>
            <Text style={styles.mutedText}>Controls seller notification popups and alert sounds.</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {userSecurityPreference.notificationsEnabled ? 'On' : 'Off'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: userSecurityPreference.orderNotificationsEnabled }}
          onPress={() => {
            updateUserSecurityPreference({
              orderNotificationsEnabled: !userSecurityPreference.orderNotificationsEnabled,
            });
            setSecurityMessage(
              userSecurityPreference.orderNotificationsEnabled
                ? 'Order alert popups turned off.'
                : 'Order alert popups turned on.',
            );
          }}
          style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
        >
          <View>
            <Text style={styles.rowTitle}>Order alerts</Text>
            <Text style={styles.mutedText}>Controls popups for order, delivery, and catalog activity.</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {userSecurityPreference.orderNotificationsEnabled ? 'On' : 'Off'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  const renderProfile = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.sectionTitle}>Store profile</Text>
        <Text style={styles.mutedText}>Applied to your listings</Text>
      </View>
      <View style={styles.profileCoverPreviewCard}>
        {profileDraft.coverImage.trim() ? (
          <Image
            resizeMode="cover"
            source={{ uri: profileDraft.coverImage }}
            style={styles.profileCoverPreviewImage}
          />
        ) : (
          <View style={styles.profileCoverPlaceholder}>
            <Ionicons color={colors.textMuted} name="image-outline" size={34} />
            <Text style={styles.previewPlaceholderTitle}>Store cover preview</Text>
            <Text style={styles.previewPlaceholderText}>
              Choose a cover photo from your gallery and it will appear here before saving.
            </Text>
          </View>
        )}
        <View style={styles.profileCoverPreviewBody}>
          <Text style={styles.rowTitle}>
            {profileDraft.ownerName.trim() || user.businessName || user.fullName}
          </Text>
          <Text style={styles.mutedText}>
            {profileDraft.address.trim() || 'Pickup/business address preview'}
          </Text>
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <FormField label="Store or owner name" onChangeText={(value) => setProfileDraft({ ...profileDraft, ownerName: value })} value={profileDraft.ownerName} />
        </View>
        <View style={styles.formColumn}>
          <FormField keyboardType="phone-pad" label="Phone" onChangeText={(value) => setProfileDraft({ ...profileDraft, phone: value })} value={profileDraft.phone} />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <FormField keyboardType="phone-pad" label="WhatsApp" onChangeText={(value) => setProfileDraft({ ...profileDraft, whatsapp: value })} value={profileDraft.whatsapp} />
        </View>
        <View style={styles.formColumn}>
          <FormField autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={(value) => setProfileDraft({ ...profileDraft, email: value })} value={profileDraft.email} />
        </View>
      </View>
      <FormField label="Pickup/business address" onChangeText={(value) => setProfileDraft({ ...profileDraft, address: value })} value={profileDraft.address} />
      <MediaPickerField
        assets={profileDraft.coverImage ? [{ label: assetLabelFromUri(profileDraft.coverImage, 'Cover image', 0), uri: profileDraft.coverImage }] : []}
        buttonLabel="Choose cover photo"
        helper="Pick a gallery image to show on your business page."
        kind="image"
        label="Cover photo"
        onClear={() => setProfileDraft({ ...profileDraft, coverImage: '' })}
        onPick={() => {
          void pickProfileMedia('coverImage', ['images'], false);
        }}
      />
      <MediaPickerField
        assets={assetsFromValue(profileDraft.galleryImages, 'Gallery image')}
        buttonLabel="Choose gallery photos"
        helper="Pick extra photos that showcase your business and products."
        kind="image"
        label="Gallery photos"
        onClear={() => setProfileDraft({ ...profileDraft, galleryImages: '' })}
        onPick={() => {
          void pickProfileMedia('galleryImages', ['images'], true);
        }}
      />
      <View style={styles.infoBox}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.rowTitle}>Admin catalog assistance</Text>
            <Text style={styles.mutedText}>
              Allow View2Connect Admin to create and update products for this store.
            </Text>
          </View>
          <Text style={styles.statusText}>
            {catalogAccessGranted ? 'Allowed' : 'Not allowed'}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <AppButton
            disabled={catalogAccessGranted}
            label="Allow catalog access"
            onPress={() => {
              setCatalogManagementAccess(user, true);
              setProfileMessage('View2Connect Admin can now manage this store catalog.');
            }}
            style={styles.flexButton}
          />
          <AppButton
            disabled={!catalogAccessGranted}
            label="Revoke access"
            onPress={() => {
              setCatalogManagementAccess(user, false);
              setProfileMessage('Admin catalog access was revoked.');
            }}
            style={styles.flexButton}
            variant="ghost"
          />
        </View>
      </View>
      {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
      {profileMessage ? <Text style={styles.successText}>{profileMessage}</Text> : null}
      <AppButton
        label={isSavingProfile ? 'Saving profile...' : 'Save profile'}
        loading={isSavingProfile}
        onPress={() => void saveProfile()}
      />
    </View>
  );

  function renderEmpty(title: string, body: string) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.mutedText}>{body}</Text>
      </View>
    );
  }

  const renderPortalNavItems = (compact = false) =>
    portalNav.map((item) => {
      const isActive = activePage === item.id;

      return (
        <Pressable
          key={item.id}
          onPress={() => setActivePage(item.id)}
          style={({ pressed }) => [
            compact ? styles.compactNavItem : styles.navItem,
            isActive && (compact ? styles.compactNavItemActive : styles.navItemActive),
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            color={isActive ? colors.primary : colors.textMuted}
            name={item.icon}
            size={compact ? 18 : 19}
          />
          <Text
            numberOfLines={1}
            style={[
              compact ? styles.compactNavText : styles.navText,
              isActive && styles.navTextActive,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      );
    });

  const pageTitle = portalNav.find((item) => item.id === activePage)?.label ?? 'Dashboard';

  return (
    <View style={[styles.shell, isCompactLayout && styles.shellCompact]}>
      {!isCompactLayout ? (
        <View style={styles.sidebar}>
          <View style={styles.brandBlock}>
            <View style={styles.brandIcon}>
              <Ionicons color={colors.white} name="storefront-outline" size={24} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandTitle}>{user.businessName ?? user.fullName}</Text>
              <Text style={styles.mutedText}>Seller workspace</Text>
            </View>
          </View>

          <View style={styles.navStack}>{renderPortalNavItems()}</View>

          <AppButton label="Sign out" onPress={signOut} variant="ghost" />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.content, isCompactLayout && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
        style={styles.contentScroll}
      >
        {isCompactLayout ? (
          <View style={styles.mobileHeader}>
            <View style={styles.mobileBrand}>
              <View style={styles.brandIconSmall}>
                <Ionicons color={colors.white} name="storefront-outline" size={18} />
              </View>
              <View style={styles.brandCopy}>
                <Text numberOfLines={1} style={styles.brandTitle}>
                  {user.businessName ?? user.fullName}
                </Text>
                <Text style={styles.mutedText}>Seller workspace</Text>
              </View>
            </View>
            <View style={styles.mobileHeaderActions}>
              <Pressable
                accessibilityLabel="Sign out"
                accessibilityRole="button"
                onPress={signOut}
                style={({ pressed }) => [styles.compactSignOut, pressed && styles.pressed]}
              >
                <Ionicons color={colors.primary} name="log-out-outline" size={18} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.topbar, isCompactLayout && styles.topbarCompact]}>
          <View>
            <Text style={styles.eyebrow}>Store owner portal</Text>
            <Text style={styles.pageTitle}>{pageTitle}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{isUrbanConnectLocalTestMode ? 'Local mode' : 'Live mode'}</Text>
          </View>
        </View>

        {isCompactLayout ? (
          <ScrollView
            contentContainerStyle={styles.mobileNavContent}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mobileNav}
          >
            {renderPortalNavItems(true)}
          </ScrollView>
        ) : null}

        {activePage === 'dashboard' ? renderDashboard() : null}
        {activePage === 'orders' ? renderOrders() : null}
        {activePage === 'items' ? renderItems() : null}
        {activePage === 'payments' ? renderPayments() : null}
        {activePage === 'security' ? renderSecurity() : null}
        {activePage === 'profile' ? renderProfile() : null}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowSellerWelcome(false)}
        transparent
        visible={showSellerWelcome}
      >
        <View style={styles.welcomeBackdrop}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}>
              <Ionicons color={colors.white} name="checkmark-circle-outline" size={28} />
            </View>
            <Text style={styles.eyebrow}>Email verified</Text>
            <Text style={styles.sectionTitle}>Welcome to your seller dashboard.</Text>
            <Text style={styles.mutedText}>
              Your {welcomePlan} application was saved and is waiting for admin review. Customer
              access must be created separately before this login can open the shopping app.
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.rowTitle}>What happens next</Text>
              <Text style={styles.mutedText}>
                Complete your profile and prepare products. Listings stay private until admin
                approval.
              </Text>
            </View>
            <AppButton label="Continue to dashboard" onPress={() => setShowSellerWelcome(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    shellCompact: {
      flexDirection: 'column',
      gap: spacing.sm,
      padding: spacing.sm,
    },
    accessShell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.background,
      padding: spacing.xl,
    },
    welcomeBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
    },
    welcomeCard: {
      width: '100%',
      maxWidth: 480,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.card,
    },
    welcomeIcon: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    sidebar: {
      width: 280,
      gap: spacing.lg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      ...shadows.card,
    },
    brandBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    brandIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 46,
      height: 46,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    brandIconSmall: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    brandCopy: {
      flex: 1,
      gap: 2,
    },
    brandTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    navStack: {
      flex: 1,
      gap: spacing.sm,
    },
    navItem: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
    },
    navItemActive: {
      backgroundColor: colors.primarySoft,
    },
    navText: {
      ...typography.bodyStrong,
      color: colors.textMuted,
    },
    navTextActive: {
      color: colors.primary,
    },
    contentScroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    contentCompact: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    mobileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      ...shadows.soft,
    },
    mobileBrand: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    mobileHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    compactSignOut: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 42,
      height: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      ...shadows.soft,
    },
    topbarCompact: {
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      padding: spacing.sm,
    },
    mobileNav: {
      flexGrow: 0,
    },
    mobileNavContent: {
      gap: spacing.sm,
      paddingRight: spacing.sm,
    },
    compactNavItem: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    compactNavItemActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    compactNavText: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '800',
    },
    pageStack: {
      gap: spacing.lg,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: colors.secondary,
    },
    pageTitle: {
      ...typography.title,
      color: colors.text,
    },
    hero: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.overlay,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroCopy: {
      flex: 1,
      minWidth: 280,
      gap: spacing.sm,
    },
    heroTitle: {
      ...typography.title,
      color: colors.white,
    },
    heroText: {
      ...typography.body,
      color: '#D6DFE2',
    },
    heroNotice: {
      ...typography.caption,
      color: colors.accent,
    },
    heroMetric: {
      minWidth: 170,
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.overlayMuted,
      padding: spacing.lg,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    statCard: {
      flex: 1,
      minWidth: 170,
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      ...shadows.soft,
    },
    statIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    statIconSecondary: {
      backgroundColor: colors.secondarySoft,
    },
    metricValue: {
      fontSize: 27,
      lineHeight: 33,
      fontWeight: '900',
      color: colors.text,
    },
    metricLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    workspaceGrid: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: spacing.lg,
    },
    panel: {
      flex: 1,
      minWidth: 320,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.soft,
    },
    panelWide: {
      flex: 1,
      minWidth: 380,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.soft,
    },
    previewPanel: {
      flex: 0.9,
      minWidth: 320,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.soft,
    },
    panelFull: {
      width: '100%',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.soft,
    },
    centralCatalogRow: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingBottom: spacing.xs,
    },
    centralCatalogCard: {
      width: 210,
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    centralCatalogImage: {
      width: '100%',
      height: 130,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    mutedText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    formRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    formColumn: {
      flex: 1,
      minWidth: 150,
    },
    formColumnWide: {
      flex: 2,
      minWidth: 260,
    },
    label: {
      ...typography.caption,
      color: colors.text,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    categoryChip: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    categoryChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    categoryText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    categoryTextActive: {
      color: colors.white,
    },

    payoutFlowCard: {
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
      ...shadows.soft,
    },
    payoutStepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    payoutStepBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    bankSearchResults: {
      gap: spacing.sm,
      maxHeight: 320,
    },
    bankOption: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.sm,
    },
    bankOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    bankOptionText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    bankOptionSubtext: {
      ...typography.caption,
      color: colors.textMuted,
    },
    selectedBankCard: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.success,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    verifiedAccountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.success,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    verifiedAccountName: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '900',
      color: colors.text,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    flexButton: {
      flex: 1,
      minWidth: 140,
    },
    uploadButton: {
      minHeight: 56,
      minWidth: 160,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    uploadButtonText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    pressed: {
      opacity: 0.88,
    },
    listCard: {
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    itemList: {
      gap: spacing.sm,
    },
    orderItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: spacing.sm,
    },
    orderItemName: {
      flex: 1,
      ...typography.bodyStrong,
      color: colors.text,
    },
    orderAmount: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    inventoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.sm,
    },
    inventoryImage: {
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
    },
    inventoryCopy: {
      flex: 1,
      gap: 2,
    },
    itemTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.sm,
    },
    previewImage: {
      width: 116,
      height: 116,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
    },
    previewCopy: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    previewTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    previewCategory: {
      ...typography.caption,
      color: colors.secondary,
      fontWeight: '800',
    },
    previewPrice: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    previewMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    previewMeta: {
      ...typography.caption,
      color: colors.textMuted,
      borderRadius: 8,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    marketplacePreviewCard: {
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
      ...shadows.soft,
    },
    marketplacePreviewImage: {
      width: '100%',
      height: 260,
      backgroundColor: colors.surfaceMuted,
    },
    previewPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      width: '100%',
      height: 260,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
    },
    previewPlaceholderTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    previewPlaceholderText: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    profileCoverPreviewCard: {
      gap: spacing.md,
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      ...shadows.soft,
    },
    profileCoverPreviewImage: {
      width: '100%',
      height: 220,
      backgroundColor: colors.surfaceMuted,
    },
    profileCoverPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      width: '100%',
      height: 220,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
    },
    profileCoverPreviewBody: {
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    marketplacePreviewBody: {
      gap: spacing.sm,
      padding: spacing.md,
    },
    marketplacePreviewTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color: colors.text,
    },
    marketplacePreviewPrice: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: colors.primary,
    },
    marketplacePreviewDescription: {
      ...typography.body,
      color: colors.textMuted,
    },
    previewInfoStack: {
      gap: spacing.xs,
    },
    statusPill: {
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    statusText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dangerIconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    textButton: {
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    textButtonText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    receiptButton: {
      alignSelf: 'flex-start',
      minWidth: 140,
    },
    editorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    editorActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    backButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    backButtonText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    editorIntro: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    editHeroImage: {
      width: 112,
      height: 112,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
    },
    editorIntroCopy: {
      flex: 1,
      minWidth: 220,
      gap: spacing.xs,
    },
    dangerButton: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.lg,
    },
    dangerButtonText: {
      ...typography.bodyStrong,
      color: colors.danger,
    },
    editPanel: {
      gap: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    emptyBox: {
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    errorBox: {
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    infoBox: {
      gap: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    rowTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    rowValue: {
      ...typography.bodyStrong,
      color: colors.primary,
      textAlign: 'right',
    },
    infoText: {
      ...typography.caption,
      color: colors.primary,
    },
    successText: {
      ...typography.caption,
      color: colors.success,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
  });
}
