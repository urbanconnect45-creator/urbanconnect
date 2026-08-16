import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import { AppButton } from '../components/AppButton';
import { MarketplaceJourneyAnimation } from '../components/MarketplaceJourneyAnimation';
import { MobileCustomerJourney } from '../components/MobileCustomerJourney';
import { UrbanConnectLogo } from '../components/UrbanConnectLogo';
import { isUrbanConnectLocalTestMode } from '../config/runtime';
import { AccountScreen } from '../screens/AccountScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminPanelScreen } from '../screens/AdminPanelScreen';
import { BusinessDetailsScreen } from '../screens/BusinessDetailsScreen';
import { CatalogAdminScreen } from '../screens/CatalogAdminScreen';
import { CartScreen } from '../screens/CartScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { CustomerBenefitsScreen } from '../screens/CustomerBenefitsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DispatchDashboardScreen } from '../screens/DispatchDashboardScreen';
import { DispatchLoginScreen } from '../screens/DispatchLoginScreen';
import { FoodScreen } from '../screens/FoodScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OrderDetailsScreen } from '../screens/OrderDetailsScreen';
import { PasswordRecoveryScreen } from '../screens/PasswordRecoveryScreen';
import { ProfessionsScreen } from '../screens/ProfessionsScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { RegisterBusinessScreen } from '../screens/RegisterBusinessScreen';
import { SellerProfileScreen } from '../screens/SellerProfileScreen';
import { SellerPortalLoginScreen } from '../screens/SellerPortalLoginScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { StoreOwnerDashboardScreen } from '../screens/StoreOwnerDashboardScreen';
import { StoresScreen } from '../screens/StoresScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { WithdrawalScreen } from '../screens/WithdrawalScreen';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { UserRole } from '../types/auth';
import { getOrderStatusLabel } from '../utils/order';
import type { AppNavigation, MainTabParamList } from './types';

type AuthRoute = 'Login' | 'Signup' | 'DispatchLogin' | 'AdminLogin';
type MainRoute = keyof MainTabParamList;
type IconName = keyof typeof Ionicons.glyphMap;
type JourneyOverlay = {
  firstName?: string;
  key: number;
  mode: 'opening' | UserRole;
};

const publicSiteUrl = 'https://www.view2connect.ng';
const socialShareLinks: Array<{
  icon: IconName;
  label: string;
  url: string;
}> = [
  {
    icon: 'logo-facebook',
    label: 'Facebook',
    url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicSiteUrl)}`,
  },
  {
    icon: 'logo-twitter',
    label: 'X',
    url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(publicSiteUrl)}&text=${encodeURIComponent('Shop and sell with View2Connect')}`,
  },
  {
    icon: 'logo-whatsapp',
    label: 'WhatsApp',
    url: `https://wa.me/?text=${encodeURIComponent(`Shop and sell with View2Connect: ${publicSiteUrl}`)}`,
  },
  {
    icon: 'logo-linkedin',
    label: 'LinkedIn',
    url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicSiteUrl)}`,
  },
];

type NavButtonProps = {
  active: boolean;
  compact?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  placement: 'sidebar' | 'bottom';
};

const routeMeta: Record<
  MainRoute,
  {
    icon: IconName;
    label: string;
    title: string;
    subtitle: string;
  }
> = {
  Dashboard: {
    icon: 'home-outline',
    label: 'Home',
    title: 'Advertisements',
    subtitle: 'Browse customer-posted classified advertisements.',
  },
  DispatchMode: {
    icon: 'bicycle-outline',
    label: 'Dispatch',
    title: 'Dispatch dashboard',
    subtitle: 'Review assigned and available delivery work.',
  },
  Stores: {
    icon: 'storefront-outline',
    label: 'Shop',
    title: 'Stores',
    subtitle: 'Browse approved stores and their available items.',
  },
  Professions: {
    icon: 'grid-outline',
    label: 'Categories',
    title: 'Categories',
    subtitle: 'Browse approved products and services by category.',
  },
  Food: {
    icon: 'restaurant-outline',
    label: 'Food',
    title: 'Food',
    subtitle: 'Browse meals, restaurants, snacks, and bakeries.',
  },
  SellerMode: {
    icon: 'storefront-outline',
    label: 'Seller',
    title: 'Seller workspace',
    subtitle: 'Manage your store, catalog, orders, payments, and security.',
  },
  RegisterBusiness: {
    icon: 'add-outline',
    label: 'List',
    title: 'Create listing',
    subtitle: 'Send item or service details for customer care inspection.',
  },
  Subscription: {
    icon: 'card-outline',
    label: 'Pay',
    title: 'Subscription',
    subtitle: 'Manage business subscription payment and listing visibility.',
  },
  CustomerBenefits: {
    icon: 'sparkles-outline',
    label: 'Benefits',
    title: 'Customer benefits',
    subtitle: 'Manage customer subscription benefits and account balance payment.',
  },
  Chats: {
    icon: 'chatbubbles-outline',
    label: 'Messages',
    title: 'Messages',
    subtitle: 'Message advertisers and customer care.',
  },
  Account: {
    icon: 'person-circle-outline',
    label: 'Profile',
    title: 'Account',
    subtitle: 'Manage orders, listings, and profile details.',
  },
  ProfileEdit: {
    icon: 'create-outline',
    label: 'Edit',
    title: 'Edit profile',
    subtitle: 'Update business profile media, contacts, and location.',
  },
  Settings: {
    icon: 'settings-outline',
    label: 'Settings',
    title: 'Settings',
    subtitle: 'Manage theme, privacy policy, and user agreement.',
  },
};

function NavButton({
  active,
  compact = false,
  icon,
  label,
  onPress,
  placement,
}: NavButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        placement === 'sidebar' ? styles.sidebarButton : styles.bottomButton,
        placement === 'sidebar' && compact && styles.sidebarButtonCompact,
        active &&
          (placement === 'sidebar'
            ? styles.sidebarButtonActive
            : styles.bottomButtonActive),
        pressed &&
          (placement === 'sidebar'
            ? styles.sidebarButtonPressed
            : styles.bottomButtonPressed),
      ]}
    >
      <View
        style={[
          placement === 'sidebar' ? styles.sidebarIconShell : styles.bottomIconShell,
          active &&
            (placement === 'sidebar'
              ? styles.sidebarIconShellActive
              : styles.bottomIconShellActive),
        ]}
      >
        <Ionicons color={active ? colors.primary : colors.textMuted} name={icon} size={22} />
      </View>
      {placement === 'sidebar' && compact ? null : (
        <Text
          style={[
            placement === 'sidebar' ? styles.sidebarLabel : styles.bottomLabel,
            active &&
              (placement === 'sidebar'
                ? styles.sidebarLabelActive
                : styles.bottomLabelActive),
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  }

  return 'Biometric';
}

function isAdminWebEntrypoint() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const pathname =
    (globalThis as { location?: { pathname?: string } }).location?.pathname?.toLowerCase() ??
    '';

  const normalizedPathname = pathname.replace(/\/+$/, '');

  return normalizedPathname === '/admin-portal' || normalizedPathname === '/catalog-admin';
}

function isCatalogAdminWebEntrypoint() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const pathname =
    (globalThis as { location?: { pathname?: string } }).location?.pathname?.toLowerCase() ??
    '';

  return pathname.replace(/\/+$/, '') === '/catalog-admin';
}

function isSellerWebEntrypoint() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const pathname =
    (globalThis as { location?: { pathname?: string } }).location?.pathname?.toLowerCase() ??
    '';

  return pathname.replace(/\/+$/, '') === '/seller-portal';
}

function isSellerDesktopRuntime() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const browser = globalThis as {
    location?: { search?: string };
    navigator?: { userAgent?: string };
  };

  return (
    new URLSearchParams(browser.location?.search ?? '').get('desktopApp') === '1' ||
    /View2ConnectSellerDesktop/i.test(browser.navigator?.userAgent ?? '')
  );
}

function isDispatchWebEntrypoint() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const location =
    (globalThis as { location?: { pathname?: string; search?: string } }).location ?? {};
  const pathname = location.pathname?.toLowerCase() ?? '';
  const normalizedPathname = pathname.replace(/\/+$/, '');

  if (normalizedPathname === '/dispatch-login') {
    return true;
  }

  return new URLSearchParams(location.search ?? '').get('oauthRole') === 'dispatch';
}

function isPublicStoreWebEntrypoint() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const pathname =
    (globalThis as { location?: { pathname?: string } }).location?.pathname?.toLowerCase() ??
    '';

  return pathname.replace(/\/+$/, '') === '';
}

function isOperaMiniWebBrowser() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const userAgent =
    (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '';

  return /opera mini|opr\/mini|opios/i.test(userAgent);
}

export function AppNavigator() {
  const {
    adminUser,
    findUserById,
    signOut,
    signOutAdmin,
    updateUserSecurityPreference,
    user,
    userSecurityPreference,
    passwordRecoveryReady,
  } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    cartCount,
    getBusinessById,
    getNotificationsForUser,
    getOrderById,
    markNotificationsRead,
    securitySettings,
    syncCustomerAccountData,
  } = useBusinessDirectory();
  const adminWebEntrypoint = useMemo(() => isAdminWebEntrypoint(), []);
  const catalogAdminWebEntrypoint = useMemo(() => isCatalogAdminWebEntrypoint(), []);
  const sellerWebEntrypoint = useMemo(() => isSellerWebEntrypoint(), []);
  const sellerDesktopRuntime = useMemo(() => isSellerDesktopRuntime(), []);
  const dispatchWebEntrypoint = useMemo(() => isDispatchWebEntrypoint(), []);
  const publicStoreWebEntrypoint = useMemo(() => isPublicStoreWebEntrypoint(), []);
  const operaMiniBrowser = useMemo(() => isOperaMiniWebBrowser(), []);
  const [journeyOverlay, setJourneyOverlay] = useState<JourneyOverlay | null>(() =>
    (Platform.OS !== 'web' || isUrbanConnectLocalTestMode || sellerDesktopRuntime) &&
    !adminWebEntrypoint
      ? { key: Date.now(), mode: 'opening' }
      : null,
  );
  const [authRoute, setAuthRoute] = useState<AuthRoute>(() =>
    adminWebEntrypoint ? 'AdminLogin' : dispatchWebEntrypoint ? 'DispatchLogin' : 'Login',
  );
  const [mainRoute, setMainRoute] = useState<MainRoute>('Dashboard');
  const [businessDetailsId, setBusinessDetailsId] = useState<string | null>(null);
  const [sellerProfileId, setSellerProfileId] = useState<string | null>(null);
  const [orderDetailsId, setOrderDetailsId] = useState<string | null>(null);
  const [isCartRoute, setIsCartRoute] = useState(false);
  const [isWithdrawalRoute, setIsWithdrawalRoute] = useState(false);
  const [isTransactionsRoute, setIsTransactionsRoute] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [openNotificationIds, setOpenNotificationIds] = useState<string[]>([]);
  const [showLoginAnnouncement, setShowLoginAnnouncement] = useState(false);
  const [showGuestAuthPage, setShowGuestAuthPage] = useState(false);
  const [showGuestAuthPrompt, setShowGuestAuthPrompt] = useState(false);
  const [showAccessChoice, setShowAccessChoice] = useState(false);
  const [showPasscodeGate, setShowPasscodeGate] = useState(false);
  const [passcodeGateDraft, setPasscodeGateDraft] = useState('');
  const [passcodeGateError, setPasscodeGateError] = useState<string | null>(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const previousUnreadCount = useRef(0);
  const previousUnreadIds = useRef<string[]>([]);
  const previousAnnouncementUserId = useRef<string | null>(null);
  const passcodeUnlockedUserId = useRef<string | null>(null);
  const biometricPromptedUserId = useRef<string | null>(null);
  const passcodePreferenceSignature = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const routeHistoryRef = useRef<MainRoute[]>([]);
  const journeyOverlayVisibleRef = useRef(Boolean(journeyOverlay));
  const previousJourneyUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    journeyOverlayVisibleRef.current = Boolean(journeyOverlay);
  }, [journeyOverlay]);

  useEffect(() => {
    const previousUserId = previousJourneyUserIdRef.current;
    const currentUserId = user?.id ?? null;

    previousJourneyUserIdRef.current = currentUserId;

    if (currentUserId && !previousUserId && !journeyOverlayVisibleRef.current && user) {
      setJourneyOverlay({
        firstName: user.firstName,
        key: Date.now(),
        mode: user.role,
      });
    }
  }, [user]);

  const completeJourneyAnimation = useCallback(() => {
    setJourneyOverlay(null);
  }, []);

  const requestGuestAuthentication = useCallback(() => {
    setShowGuestAuthPrompt(true);
  }, []);

  const openWebPath = useCallback((path: string) => {
    const targetUrl = `${publicSiteUrl}${path}`;

    if (Platform.OS === 'web') {
      const location = (globalThis as { location?: { href: string } }).location;

      if (location) {
        location.href = targetUrl;
        return;
      }
    }

    void Linking.openURL(targetUrl).catch(() => {
      Alert.alert(
        'Open on the website',
        'Seller registration and catalog management are available from view2connect.ng.',
      );
    });
  }, []);

  const openSocialShare = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open social app', 'Please try again from your browser.');
    });
  }, []);

  useEffect(() => {
    void syncCustomerAccountData(user).catch(() => undefined);
  }, [user?.id]);

  const unlockPasscodeGate = useCallback(() => {
    if (user) {
      passcodeUnlockedUserId.current = user.id;
    }

    setPasscodeGateDraft('');
    setPasscodeGateError(null);
    setShowPasscodeGate(false);
  }, [user]);

  const handleBiometricGateUnlock = useCallback(async () => {
    if (!userSecurityPreference.biometricEnabled) {
      return;
    }

    try {
      setIsCheckingBiometric(true);
      setPasscodeGateError(null);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsBiometricAvailable(false);
        setPasscodeGateError('Face ID or Touch ID is not ready on this device.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
        promptMessage: 'Unlock View2Connect',
      });

      if (result.success) {
        unlockPasscodeGate();
        return;
      }

      setPasscodeGateError('Biometric unlock was cancelled.');
    } catch {
      setPasscodeGateError('Unable to start biometric unlock on this device.');
    } finally {
      setIsCheckingBiometric(false);
    }
  }, [unlockPasscodeGate, userSecurityPreference.biometricEnabled]);

  useEffect(() => {
    if (!user) {
      setAuthRoute(
        adminWebEntrypoint ? 'AdminLogin' : dispatchWebEntrypoint ? 'DispatchLogin' : 'Login',
      );

      if (!publicStoreWebEntrypoint) {
        setMainRoute('Dashboard');
        setBusinessDetailsId(null);
        setIsCartRoute(false);
        setIsWithdrawalRoute(false);
        setIsTransactionsRoute(false);
        setSellerProfileId(null);
        setOrderDetailsId(null);
      }

      setShowMenuSheet(false);
      setShowNotifications(false);
      setShowLoginAnnouncement(false);
      setShowPasscodeGate(false);
      setPasscodeGateDraft('');
      setPasscodeGateError(null);
      previousAnnouncementUserId.current = null;
      passcodeUnlockedUserId.current = null;
      return;
    }

    setShowGuestAuthPage(false);
    setShowGuestAuthPrompt(false);

    if (user.role === 'businessOwner' && mainRoute !== 'SellerMode') {
      setMainRoute('SellerMode');
      return;
    }

    if (
      user.role === 'dispatch' &&
      mainRoute !== 'DispatchMode' &&
      mainRoute !== 'Account' &&
      mainRoute !== 'ProfileEdit' &&
      mainRoute !== 'Settings'
    ) {
      setMainRoute('DispatchMode');
      return;
    }

    if (
      user.role !== 'businessOwner' &&
      user.role !== 'dispatch' &&
      (mainRoute === 'Subscription' || mainRoute === 'SellerMode' || mainRoute === 'DispatchMode')
    ) {
      setMainRoute('Dashboard');
    }
  }, [adminWebEntrypoint, dispatchWebEntrypoint, mainRoute, publicStoreWebEntrypoint, user]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !publicStoreWebEntrypoint || !user) {
      return;
    }

    const browserWindow = globalThis as {
      history?: { replaceState: (state: unknown, title: string, url: string) => void };
      location?: { search?: string };
    };
    const search = browserWindow.location?.search ?? '';

    if (new URLSearchParams(search).get('paymentReturn') !== 'flutterwave') {
      return;
    }

    setShowGuestAuthPage(false);
    setMainRoute('Account');
    browserWindow.history?.replaceState(null, '', '/');
  }, [publicStoreWebEntrypoint, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (
      securitySettings.loginAnnouncementEnabled &&
      previousAnnouncementUserId.current !== user.id
    ) {
      setShowLoginAnnouncement(true);
    }

    previousAnnouncementUserId.current = user.id;
  }, [securitySettings.loginAnnouncementEnabled, user]);

  useEffect(() => {
    if (!user || adminUser) {
      setShowPasscodeGate(false);
      setPasscodeGateDraft('');
      setPasscodeGateError(null);
      setIsBiometricAvailable(false);
      setBiometricLabel('Biometric');
      passcodeUnlockedUserId.current = null;
      biometricPromptedUserId.current = null;
      passcodePreferenceSignature.current = null;
      return;
    }

    const hasPasscode = Boolean(
      userSecurityPreference.passcodeEnabled && userSecurityPreference.passcode,
    );
    const hasBiometric = userSecurityPreference.biometricEnabled;

    if (!hasPasscode && !hasBiometric) {
      setShowPasscodeGate(false);
      setPasscodeGateDraft('');
      setPasscodeGateError(null);
      passcodeUnlockedUserId.current = user.id;
      biometricPromptedUserId.current = null;
      passcodePreferenceSignature.current = `${user.id}:none`;
      return;
    }

    const currentPreferenceSignature = `${user.id}:${hasPasscode ? userSecurityPreference.passcode : 'none'}:${hasBiometric}:${userSecurityPreference.updatedAt}`;
    if (passcodePreferenceSignature.current !== currentPreferenceSignature) {
      passcodeUnlockedUserId.current = null;
      biometricPromptedUserId.current = null;
      passcodePreferenceSignature.current = currentPreferenceSignature;
    }

    if (passcodeUnlockedUserId.current !== user.id) {
      setShowPasscodeGate(true);
      setPasscodeGateDraft('');
      setPasscodeGateError(null);
    }
  }, [
    adminUser,
    user,
    userSecurityPreference.biometricEnabled,
    userSecurityPreference.passcode,
    userSecurityPreference.passcodeEnabled,
    userSecurityPreference.updatedAt,
  ]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (!user || adminUser) {
        return;
      }

      const lockEnabled =
        userSecurityPreference.biometricEnabled ||
        Boolean(userSecurityPreference.passcodeEnabled && userSecurityPreference.passcode);

      if (/inactive|background/.test(nextState) && lockEnabled) {
        passcodeUnlockedUserId.current = null;
        biometricPromptedUserId.current = null;
        setPasscodeGateDraft('');
        setPasscodeGateError(null);
        setShowPasscodeGate(true);
        return;
      }

      if (
        nextState === 'active' &&
        /inactive|background/.test(previousState) &&
        lockEnabled
      ) {
        biometricPromptedUserId.current = null;
        setShowPasscodeGate(true);
      }
    });

    return () => subscription.remove();
  }, [
    adminUser,
    user,
    userSecurityPreference.biometricEnabled,
    userSecurityPreference.passcode,
    userSecurityPreference.passcodeEnabled,
  ]);

  useEffect(() => {
    if (!user || !userSecurityPreference.biometricEnabled) {
      setIsBiometricAvailable(false);
      setBiometricLabel('Biometric');
      return undefined;
    }

    let isMounted = true;

    const checkBiometricAvailability = async () => {
      try {
        const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);

        if (!isMounted) {
          return;
        }

        setIsBiometricAvailable(hasHardware && isEnrolled);
        setBiometricLabel(getBiometricLabel(supportedTypes));
      } catch {
        if (isMounted) {
          setIsBiometricAvailable(false);
          setBiometricLabel('Biometric');
        }
      }
    };

    void checkBiometricAvailability();

    return () => {
      isMounted = false;
    };
  }, [user, userSecurityPreference.biometricEnabled]);

  useEffect(() => {
    if (
      !user ||
      !showPasscodeGate ||
      !userSecurityPreference.biometricEnabled ||
      !isBiometricAvailable ||
      biometricPromptedUserId.current === user.id
    ) {
      return;
    }

    biometricPromptedUserId.current = user.id;
    void handleBiometricGateUnlock();
  }, [
    handleBiometricGateUnlock,
    isBiometricAvailable,
    showPasscodeGate,
    user,
    userSecurityPreference.biometricEnabled,
  ]);

  const navigation = useMemo<AppNavigation>(
    () => ({
      navigate: ((
        screen: string,
        params?: { businessId: string } | { userId: string } | { orderId: string },
      ) => {
        if (screen === 'AuthPrompt') {
          if (publicStoreWebEntrypoint && !user) {
            requestGuestAuthentication();
          } else {
            setAuthRoute('Login');
          }
          return;
        }

        if (
          screen === 'Login' ||
          screen === 'Signup' ||
          screen === 'DispatchLogin' ||
          screen === 'AdminLogin'
        ) {
          setAuthRoute(screen);
          setShowGuestAuthPrompt(false);

          if (publicStoreWebEntrypoint && screen !== 'AdminLogin') {
            setShowGuestAuthPage(true);
          }
          return;
        }

        if (
          publicStoreWebEntrypoint &&
          !user &&
          (screen === 'Dashboard' ||
            screen === 'Stores' ||
            screen === 'Professions' ||
            screen === 'Food')
        ) {
          setShowGuestAuthPage(false);
          setShowGuestAuthPrompt(false);
        }

        if (
          publicStoreWebEntrypoint &&
          !user &&
          (screen === 'SellerProfile' ||
            screen === 'Cart' ||
            screen === 'Withdrawal' ||
            screen === 'Transactions' ||
            screen === 'OrderDetails' ||
            screen === 'SellerMode' ||
            screen === 'RegisterBusiness' ||
            screen === 'Subscription' ||
            screen === 'CustomerBenefits' ||
            screen === 'Chats' ||
            screen === 'Account' ||
            screen === 'ProfileEdit' ||
            screen === 'Settings')
        ) {
          requestGuestAuthentication();
          return;
        }

        if (screen === 'BusinessDetails') {
          if (params && 'businessId' in params) {
            setIsCartRoute(false);
            setIsWithdrawalRoute(false);
            setIsTransactionsRoute(false);
            setSellerProfileId(null);
            setOrderDetailsId(null);
            setBusinessDetailsId(params.businessId);
          }
          return;
        }

        if (screen === 'SellerProfile') {
          if (params && 'userId' in params) {
            setIsCartRoute(false);
            setIsWithdrawalRoute(false);
            setIsTransactionsRoute(false);
            setBusinessDetailsId(null);
            setOrderDetailsId(null);
            setSellerProfileId(params.userId);
          }
          return;
        }

        if (screen === 'OrderDetails') {
          if (params && 'orderId' in params) {
            setBusinessDetailsId(null);
            setSellerProfileId(null);
            setIsCartRoute(false);
            setIsWithdrawalRoute(false);
            setIsTransactionsRoute(false);
            setOrderDetailsId(params.orderId);
          }
          return;
        }

        if (screen === 'Cart') {
          setBusinessDetailsId(null);
          setSellerProfileId(null);
          setOrderDetailsId(null);
          setIsWithdrawalRoute(false);
          setIsTransactionsRoute(false);
          setIsCartRoute(true);
          return;
        }

        if (screen === 'Withdrawal') {
          setBusinessDetailsId(null);
          setSellerProfileId(null);
          setOrderDetailsId(null);
          setIsCartRoute(false);
          setIsTransactionsRoute(false);
          setIsWithdrawalRoute(true);
          return;
        }

        if (screen === 'Transactions') {
          setBusinessDetailsId(null);
          setSellerProfileId(null);
          setOrderDetailsId(null);
          setIsCartRoute(false);
          setIsWithdrawalRoute(false);
          setIsTransactionsRoute(true);
          return;
        }

        if (
          screen === 'Dashboard' ||
          screen === 'Stores' ||
          screen === 'Professions' ||
          screen === 'Food' ||
          screen === 'DispatchMode' ||
          screen === 'SellerMode' ||
          screen === 'RegisterBusiness' ||
          screen === 'Subscription' ||
          screen === 'CustomerBenefits' ||
          screen === 'Chats' ||
          screen === 'Account' ||
          screen === 'ProfileEdit' ||
          screen === 'Settings'
        ) {
          setBusinessDetailsId(null);
          setIsCartRoute(false);
          setIsWithdrawalRoute(false);
          setIsTransactionsRoute(false);
          setSellerProfileId(null);
          setOrderDetailsId(null);
          if (mainRoute !== screen) {
            routeHistoryRef.current.push(mainRoute);
          }

          setMainRoute(screen);
        }
      }) as AppNavigation['navigate'],
      replace: ((
        screen: 'OrderDetails' | 'BusinessDetails' | 'SellerProfile',
        params: { businessId: string } | { userId: string } | { orderId: string },
      ) => {
        if (
          publicStoreWebEntrypoint &&
          !user &&
          (screen === 'OrderDetails' || screen === 'SellerProfile')
        ) {
          requestGuestAuthentication();
          return;
        }

        if (screen === 'OrderDetails' && 'orderId' in params) {
          setIsCartRoute(false);
          setIsWithdrawalRoute(false);
          setIsTransactionsRoute(false);
          setBusinessDetailsId(null);
          setSellerProfileId(null);
          setOrderDetailsId(params.orderId);
          return;
        }

        if (screen === 'SellerProfile' && 'userId' in params) {
          setIsCartRoute(false);
          setIsWithdrawalRoute(false);
          setIsTransactionsRoute(false);
          setBusinessDetailsId(null);
          setOrderDetailsId(null);
          setSellerProfileId(params.userId);
          return;
        }

        if ('businessId' in params) {
          setIsCartRoute(false);
          setIsWithdrawalRoute(false);
          setIsTransactionsRoute(false);
          setSellerProfileId(null);
          setOrderDetailsId(null);
          setBusinessDetailsId(params.businessId);
        }
      }) as AppNavigation['replace'],
      goBack: () => {
        if (businessDetailsId) {
          setBusinessDetailsId(null);
          return;
        }

        if (sellerProfileId) {
          setSellerProfileId(null);
          return;
        }

        if (orderDetailsId) {
          setOrderDetailsId(null);
          return;
        }

        if (isCartRoute) {
          setIsCartRoute(false);
          return;
        }

        if (isWithdrawalRoute) {
          setIsWithdrawalRoute(false);
          return;
        }

        if (isTransactionsRoute) {
          setIsTransactionsRoute(false);
          return;
        }

        if (!user && authRoute === 'Signup') {
          setAuthRoute('Login');
          return;
        }

        if (!user && publicStoreWebEntrypoint && showGuestAuthPage) {
          setShowGuestAuthPage(false);
          setAuthRoute('Login');
          return;
        }

        if (routeHistoryRef.current.length > 0) {
          const previous = routeHistoryRef.current.pop()!;
          setMainRoute(previous);
          return;
        }

        setMainRoute('Dashboard');
      },
    }),
    [
      authRoute,
      businessDetailsId,
      isCartRoute,
      isTransactionsRoute,
      isWithdrawalRoute,
      orderDetailsId,
      publicStoreWebEntrypoint,
      requestGuestAuthentication,
      sellerProfileId,
      showGuestAuthPage,
      user,
    ],
  );

  const isMobileLayout = width < 780;
  const compactSidebar = width < 980;
  const isDispatchUser = user?.role === 'dispatch';
  const sellerWebBlockedOnMobile = sellerWebEntrypoint && width < 900;
  const sellerToolsBlockedOnMobileWeb = Platform.OS === 'web' && width < 900;
  const adminWebBlockedOnMobile =
    adminWebEntrypoint && !catalogAdminWebEntrypoint && width < 900;
  const secureWebRouteRequested =
    adminWebEntrypoint ||
    sellerWebEntrypoint ||
    catalogAdminWebEntrypoint ||
    authRoute === 'DispatchLogin' ||
    mainRoute === 'DispatchMode' ||
    mainRoute === 'SellerMode' ||
    mainRoute === 'Subscription' ||
    isWithdrawalRoute ||
    isTransactionsRoute;
  const operaMiniBlockedSecurePage = operaMiniBrowser && secureWebRouteRequested;
  const browsingPublicStore =
    publicStoreWebEntrypoint && !user && !adminUser && !showGuestAuthPage;
  const loginAnnouncementAudience =
    user?.role === 'businessOwner'
      ? 'Store owner'
      : user?.role === 'dispatch'
        ? 'Dispatch'
        : 'Customer';

  let content: React.ReactNode;

  const handleReturnToApp = () => {
    signOutAdmin();
    setAuthRoute(adminWebEntrypoint ? 'AdminLogin' : 'Login');
  };

  if (operaMiniBlockedSecurePage) {
    content = (
      <View style={styles.adminMobileBlocked}>
        <UrbanConnectLogo />
        <View style={styles.adminMobileBlockedCard}>
          <Ionicons color={colors.primary} name="alert-circle-outline" size={34} />
          <Text style={styles.adminMobileBlockedTitle}>Unsupported browser for secure pages</Text>
          <Text style={styles.adminMobileBlockedText}>
            Opera Mini can block secure auth, admin, seller, dispatch, and payment features.
            Please use Chrome, Safari, Edge, Firefox, or the full Opera Browser.
          </Text>
        </View>
      </View>
    );
  } else if (adminWebBlockedOnMobile) {
    content = (
      <View style={styles.adminMobileBlocked}>
        <UrbanConnectLogo />
        <View style={styles.adminMobileBlockedCard}>
          <Ionicons color={colors.primary} name="laptop-outline" size={34} />
          <Text style={styles.adminMobileBlockedTitle}>Admin is desktop only</Text>
          <Text style={styles.adminMobileBlockedText}>
            Open this private admin link on a laptop or desktop browser. Mobile web is reserved
            for the public download website.
          </Text>
        </View>
      </View>
    );
  } else if (adminWebEntrypoint) {
    content = adminUser ? (
      catalogAdminWebEntrypoint ? (
        <CatalogAdminScreen />
      ) : (
        <AdminPanelScreen onReturnToApp={handleReturnToApp} />
      )
    ) : (
      <AdminLoginScreen navigation={navigation} />
    );
  } else if (sellerWebBlockedOnMobile) {
    content = (
      <View style={styles.adminMobileBlocked}>
        <UrbanConnectLogo />
        <View style={styles.adminMobileBlockedCard}>
          <Ionicons color={colors.primary} name="laptop-outline" size={34} />
          <Text style={styles.adminMobileBlockedTitle}>Seller tools are desktop only</Text>
          <Text style={styles.adminMobileBlockedText}>
            Seller login and business registration are only available on laptop or desktop.
            Please use a larger screen to continue.
          </Text>
        </View>
      </View>
    );
  } else if (sellerWebEntrypoint) {
    content = user ? (
      user.role === 'businessOwner' ? (
        <StoreOwnerDashboardScreen />
      ) : user.role === 'dispatch' ? (
        <DispatchDashboardScreen />
      ) : (
        <SellerPortalLoginScreen />
      )
    ) : (
      <SellerPortalLoginScreen />
    );
  } else if (adminUser) {
    content = <AdminPanelScreen onReturnToApp={handleReturnToApp} />;
  } else if (browsingPublicStore) {
    content = businessDetailsId ? (
      <BusinessDetailsScreen
        navigation={navigation}
        route={{ params: { businessId: businessDetailsId } }}
      />
    ) : mainRoute === 'Professions' ? (
      <ProfessionsScreen navigation={navigation} />
    ) : mainRoute === 'Stores' ? (
      <StoresScreen navigation={navigation} />
    ) : mainRoute === 'Food' ? (
      <FoodScreen navigation={navigation} />
    ) : (
      <DashboardScreen navigation={navigation} />
    );
  } else if (!user) {
    content =
      authRoute === 'AdminLogin' ? (
        <AdminLoginScreen navigation={navigation} />
      ) : authRoute === 'Signup' ? (
        <SignupScreen navigation={navigation} />
      ) : authRoute === 'DispatchLogin' ? (
        <DispatchLoginScreen />
      ) : (
        <LoginScreen navigation={navigation} />
      );
  } else if (isCartRoute) {
    content = <CartScreen navigation={navigation} />;
  } else if (isWithdrawalRoute) {
    content = <WithdrawalScreen navigation={navigation} />;
  } else if (isTransactionsRoute) {
    content = <TransactionsScreen navigation={navigation} />;
  } else if (orderDetailsId) {
    content = (
      <OrderDetailsScreen
        navigation={navigation}
        route={{ params: { orderId: orderDetailsId } }}
      />
    );
  } else if (businessDetailsId) {
    content = (
      <BusinessDetailsScreen
        navigation={navigation}
        route={{ params: { businessId: businessDetailsId } }}
      />
    );
  } else if (sellerProfileId) {
    content = (
      <SellerProfileScreen
        navigation={navigation}
        route={{ params: { userId: sellerProfileId } }}
      />
    );
  } else if (mainRoute === 'SellerMode' && user.role === 'businessOwner') {
    content = <StoreOwnerDashboardScreen />;
  } else if (mainRoute === 'DispatchMode' && user.role === 'dispatch') {
    content = <DispatchDashboardScreen />;
  } else if (mainRoute === 'Professions') {
    content = <ProfessionsScreen navigation={navigation} />;
  } else if (mainRoute === 'Stores') {
    content = <StoresScreen navigation={navigation} />;
  } else if (mainRoute === 'Food') {
    content = <FoodScreen navigation={navigation} />;
  } else if (mainRoute === 'RegisterBusiness') {
    content = <RegisterBusinessScreen navigation={navigation} />;
  } else if (mainRoute === 'Chats') {
    content = <ChatsScreen navigation={navigation} />;
  } else if (mainRoute === 'Subscription' && user.role === 'businessOwner') {
    content = <SubscriptionScreen navigation={navigation} />;
  } else if (mainRoute === 'CustomerBenefits') {
    content = <CustomerBenefitsScreen navigation={navigation} />;
  } else if (mainRoute === 'ProfileEdit') {
    content = <ProfileEditScreen navigation={navigation} />;
  } else if (mainRoute === 'Settings') {
    content = <SettingsScreen navigation={navigation} />;
  } else if (mainRoute === 'Account') {
    content = <AccountScreen navigation={navigation} />;
  } else {
    content = <DashboardScreen navigation={navigation} />;
  }

  const shouldUseWebAuthFrame =
    Platform.OS === 'web' &&
    !user &&
    !adminUser &&
    !adminWebEntrypoint &&
    !sellerWebEntrypoint &&
    !browsingPublicStore &&
    authRoute !== 'AdminLogin';
  const framedContent = shouldUseWebAuthFrame ? (
    <View style={[styles.authWebStage, width >= 900 && styles.authWebStageWide]}>
      <View style={[styles.authWebFrame, width >= 900 && styles.authWebFrameWide]}>
        {content}
      </View>
    </View>
  ) : (
    content
  );

  const activeBusiness = businessDetailsId ? getBusinessById(businessDetailsId) : undefined;
  const activeOrder = orderDetailsId ? getOrderById(orderDetailsId) : undefined;
  const activeSeller = sellerProfileId ? findUserById(sellerProfileId) : undefined;
  const topBarTitle =
    isCartRoute
      ? 'Your cart'
      : isWithdrawalRoute
        ? 'Withdrawal'
        : isTransactionsRoute
          ? 'Transactions'
      : activeOrder
        ? activeOrder.id
      : activeBusiness?.name ??
        activeSeller?.businessName ??
        activeSeller?.fullName ??
        routeMeta[mainRoute].title;
  const topBarSubtitle = isCartRoute
    ? 'Review saved items, enter delivery details, and place the order from one page.'
    : isWithdrawalRoute
      ? 'Withdraw warehouse-verified seller earnings to a bank account.'
      : isTransactionsRoute
        ? 'Review deposits, withdrawals, purchases, subscriptions, and seller earnings.'
    : activeOrder
      ? `${getOrderStatusLabel(activeOrder.status)} - ${activeOrder.items.length} item${activeOrder.items.length > 1 ? 's' : ''} - ${activeOrder.deliveryCluster}`
    : activeBusiness
    ? activeBusiness.listingType === 'product'
      ? 'Product details'
      : 'Profession profile'
    : activeSeller
      ? `${activeSeller.firstName}'s approved business profile.`
      : isDispatchUser && mainRoute === 'Account'
        ? 'Manage dispatch profile details and account settings.'
        : routeMeta[mainRoute].subtitle;

  const runMenuAction = (action: () => void) => {
    setShowMenuSheet(false);
    action();
  };
  const userNotifications = getNotificationsForUser(user);
  const unreadNotifications = userNotifications.filter((notification) => !notification.readAt);
  const modalNotifications =
    openNotificationIds.length > 0
      ? userNotifications.filter((notification) => openNotificationIds.includes(notification.id))
      : unreadNotifications;
  const unreadNotificationCount = unreadNotifications.length;
  const alertableUnreadNotifications = userSecurityPreference.orderNotificationsEnabled
    ? unreadNotifications
    : unreadNotifications.filter((notification) => notification.contextType !== 'order');
  const alertableUnreadCount = userSecurityPreference.notificationsEnabled
    ? alertableUnreadNotifications.length
    : 0;
  useEffect(() => {
    const previousIds = new Set(previousUnreadIds.current);
    const newUnreadNotifications = alertableUnreadNotifications.filter(
      (notification) => !previousIds.has(notification.id),
    );

    if (alertableUnreadCount > previousUnreadCount.current) {
      try {
        if (typeof window !== 'undefined') {
          const audioContext = new (window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();

          oscillator.frequency.value = 880;
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.setValueAtTime(0.08, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.18);
        }
      } catch {
        // Notification sound is best-effort and may be blocked until the user interacts.
      }
    }

    if (user && newUnreadNotifications.length > 0 && !adminUser) {
      setOpenNotificationIds(newUnreadNotifications.map((notification) => notification.id));
      setShowNotifications(true);
      markNotificationsRead(user.id);
    }

    previousUnreadCount.current = alertableUnreadCount;
    previousUnreadIds.current = alertableUnreadNotifications.map((notification) => notification.id);
  }, [
    adminUser,
    alertableUnreadCount,
    alertableUnreadNotifications,
    markNotificationsRead,
    user,
  ]);
  const openNotifications = () => {
    setOpenNotificationIds(unreadNotifications.map((notification) => notification.id));
    setShowNotifications(true);

    if (user) {
      markNotificationsRead(user.id);
    }
  };
  const handlePasscodeGateUnlock = () => {
    const cleanedPasscode = passcodeGateDraft.replace(/\D/g, '').slice(0, 6);

    if (cleanedPasscode !== userSecurityPreference.passcode) {
      setPasscodeGateError('Passcode is incorrect.');
      return;
    }

    unlockPasscodeGate();
  };

  const disableBiometricGate = () => {
    updateUserSecurityPreference({ biometricEnabled: false });
    biometricPromptedUserId.current = null;
    unlockPasscodeGate();
  };

  const appContent = browsingPublicStore ? (
    <View style={styles.guestStoreShell}>
      <View style={[styles.guestStoreHeader, isMobileLayout && styles.guestStoreHeaderMobile]}>
        <View style={styles.guestBrandRow}>
          <UrbanConnectLogo />
          <View style={styles.cacBadge}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={16} />
            <Text style={styles.cacBadgeText}>CAC registered</Text>
          </View>
          <View style={styles.guestSocialRow}>
            {socialShareLinks.map((link) => (
              <Pressable
                accessibilityLabel={`Share on ${link.label}`}
                accessibilityRole="button"
                key={link.label}
                onPress={() => openSocialShare(link.url)}
                style={({ pressed }) => [
                  styles.guestSocialButton,
                  pressed && styles.topActionButtonPressed,
                ]}
              >
                <Ionicons color={colors.primary} name={link.icon} size={17} />
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[styles.guestStoreNav, isMobileLayout && styles.guestStoreNavMobile]}>
          <Pressable
            accessibilityLabel="Open stores"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Stores')}
            style={({ pressed }) => [
              styles.guestNavButton,
              isMobileLayout && styles.guestNavButtonMobile,
              mainRoute === 'Stores' && !businessDetailsId && styles.guestNavButtonActive,
              pressed && styles.topActionButtonPressed,
            ]}
          >
            <Ionicons color={colors.primary} name="storefront-outline" size={18} />
            <Text style={styles.guestNavText}>Shop</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Professions')}
            style={({ pressed }) => [
              styles.guestNavButton,
              isMobileLayout && styles.guestNavButtonMobile,
              mainRoute === 'Professions' && styles.guestNavButtonActive,
              pressed && styles.topActionButtonPressed,
            ]}
          >
            <Ionicons color={colors.primary} name="grid-outline" size={18} />
            <Text style={styles.guestNavText}>Categories</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Open food marketplace"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Food')}
            style={({ pressed }) => [
              styles.guestNavButton,
              isMobileLayout && styles.guestNavButtonMobile,
              mainRoute === 'Food' && styles.guestNavButtonActive,
              pressed && styles.topActionButtonPressed,
            ]}
          >
            <Ionicons color={colors.primary} name="restaurant-outline" size={18} />
            <Text style={styles.guestNavText}>Food</Text>
          </Pressable>
          {!sellerToolsBlockedOnMobileWeb ? (
            <Pressable
              accessibilityLabel="Post advertisement"
              accessibilityRole="button"
              onPress={() => openWebPath('/business-registration/')}
              style={({ pressed }) => [
                styles.guestNavButton,
                styles.guestSellButton,
                isMobileLayout && styles.guestNavButtonMobile,
                pressed && styles.topActionButtonPressed,
              ]}
            >
              <Ionicons color={colors.white} name="pricetag-outline" size={18} />
              <Text style={styles.guestSellText}>Post Ad</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Open sign in"
            accessibilityRole="button"
            onPress={() => setShowAccessChoice(true)}
            style={({ pressed }) => [
              styles.guestSignInButton,
              isMobileLayout && styles.guestSignInButtonMobile,
              pressed && styles.topActionButtonPressed,
            ]}
          >
            <Ionicons
              color={isMobileLayout ? colors.primary : colors.white}
              name="person-outline"
              size={18}
            />
            <Text
              style={[styles.guestSignInText, isMobileLayout && styles.guestSignInTextMobile]}
            >
              Sign in
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.guestStoreContent}>{content}</View>
    </View>
  ) : user &&
    user.role === 'businessOwner' &&
    mainRoute === 'SellerMode' &&
    !adminUser &&
    !adminWebEntrypoint &&
    !sellerWebEntrypoint ? (
    <View style={styles.fullContent}>{content}</View>
  ) : user && !adminUser && !adminWebEntrypoint && !sellerWebEntrypoint ? (
      isMobileLayout ? (
        <View style={styles.mobileShell}>
          <View style={styles.topBar}>
            <UrbanConnectLogo compact />
            <View style={styles.topBarCopy}>
              <Text numberOfLines={1} style={styles.topBarTitle}>
                {topBarTitle}
              </Text>
              <Text numberOfLines={1} style={styles.topBarSubtitle}>
                {topBarSubtitle}
              </Text>
            </View>
            <View style={styles.topBarActions}>
              {!isDispatchUser ? (
                <Pressable
                  accessibilityLabel="Post advertisement"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => navigation.navigate('RegisterBusiness')}
                  style={({ pressed }) => [
                    styles.topActionButton,
                    styles.sellActionButton,
                    pressed && styles.topActionButtonPressed,
                  ]}
                >
                  <Ionicons color={colors.white} name="pricetag-outline" size={20} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={openNotifications}
                style={({ pressed }) => [
                  styles.topActionButton,
                  pressed && styles.topActionButtonPressed,
                ]}
              >
                <Ionicons color={colors.primary} name="notifications-outline" size={20} />
                {unreadNotificationCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{unreadNotificationCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              {!isDispatchUser ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => navigation.navigate('Cart')}
                  style={({ pressed }) => [
                    styles.topActionButton,
                    pressed && styles.topActionButtonPressed,
                  ]}
                >
                  <Ionicons color={colors.primary} name="cart-outline" size={20} />
                  {cartCount > 0 ? (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cartCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowMenuSheet(true)}
                style={({ pressed }) => [
                  styles.topActionButton,
                  pressed && styles.topActionButtonPressed,
                ]}
              >
                <Ionicons color={colors.primary} name="menu-outline" size={20} />
              </Pressable>
            </View>
          </View>

          <View pointerEvents="auto" style={styles.mobileContent}>{content}</View>

          <View style={styles.bottomBar}>
            {isDispatchUser ? (
              <>
                <NavButton
                  active={mainRoute === 'DispatchMode'}
                  icon={routeMeta.DispatchMode.icon}
                  label={routeMeta.DispatchMode.label}
                  onPress={() => navigation.navigate('DispatchMode')}
                  placement="bottom"
                />
                <NavButton
                  active={mainRoute === 'Account'}
                  icon={routeMeta.Account.icon}
                  label={routeMeta.Account.label}
                  onPress={() => navigation.navigate('Account')}
                  placement="bottom"
                />
              </>
            ) : (
              <>
                <NavButton
                  active={mainRoute === 'Dashboard'}
                  icon={routeMeta.Dashboard.icon}
                  label={routeMeta.Dashboard.label}
                  onPress={() => navigation.navigate('Dashboard')}
                  placement="bottom"
                />
                <NavButton
                  active={mainRoute === 'Stores'}
                  icon={'storefront-outline'}
                  label={'Shop'}
                  onPress={() => navigation.navigate('Stores')}
                  placement="bottom"
                />
                <NavButton
                  active={mainRoute === 'Food'}
                  icon={routeMeta.Food.icon}
                  label={routeMeta.Food.label}
                  onPress={() => navigation.navigate('Food')}
                  placement="bottom"
                />
                <NavButton
                  active={mainRoute === 'Chats'}
                  icon={routeMeta.Chats.icon}
                  label={routeMeta.Chats.label}
                  onPress={() => navigation.navigate('Chats')}
                  placement="bottom"
                />
                <NavButton
                  active={mainRoute === 'Account'}
                  icon={routeMeta.Account.icon}
                  label={routeMeta.Account.label}
                  onPress={() => navigation.navigate('Account')}
                  placement="bottom"
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.desktopShell}>
          <View style={[styles.sidebar, compactSidebar && styles.sidebarCompact]}>
            <View style={styles.sidebarTop}>
              <View style={styles.brandShell}>
                <UrbanConnectLogo compact={compactSidebar} />
              </View>

              <View style={styles.sidebarNav}>
                {isDispatchUser ? (
                  <>
                    <NavButton
                      active={mainRoute === 'DispatchMode'}
                      compact={compactSidebar}
                      icon={routeMeta.DispatchMode.icon}
                      label={routeMeta.DispatchMode.label}
                      onPress={() => navigation.navigate('DispatchMode')}
                      placement="sidebar"
                    />
                    <NavButton
                      active={mainRoute === 'Account'}
                      compact={compactSidebar}
                      icon={routeMeta.Account.icon}
                      label={routeMeta.Account.label}
                      onPress={() => navigation.navigate('Account')}
                      placement="sidebar"
                    />
                  </>
                ) : (
                  <>
                    <NavButton
                      active={mainRoute === 'Dashboard'}
                      compact={compactSidebar}
                      icon={routeMeta.Dashboard.icon}
                      label={routeMeta.Dashboard.label}
                      onPress={() => navigation.navigate('Dashboard')}
                      placement="sidebar"
                    />
                    <NavButton
                      active={mainRoute === 'Stores'}
                      compact={compactSidebar}
                      icon={'storefront-outline'}
                      label={'Shop'}
                      onPress={() => navigation.navigate('Stores')}
                      placement="sidebar"
                    />
                    <NavButton
                      active={mainRoute === 'Food'}
                      compact={compactSidebar}
                      icon={routeMeta.Food.icon}
                      label={routeMeta.Food.label}
                      onPress={() => navigation.navigate('Food')}
                      placement="sidebar"
                    />
                    <NavButton
                      active={mainRoute === 'Chats'}
                      compact={compactSidebar}
                      icon={routeMeta.Chats.icon}
                      label={routeMeta.Chats.label}
                      onPress={() => navigation.navigate('Chats')}
                      placement="sidebar"
                    />
                    <NavButton
                      active={mainRoute === 'Account'}
                      compact={compactSidebar}
                      icon={routeMeta.Account.icon}
                      label={routeMeta.Account.label}
                      onPress={() => navigation.navigate('Account')}
                      placement="sidebar"
                    />
                  </>
                )}
              </View>
            </View>

            {!compactSidebar ? (
              <View style={styles.sidebarFooter}>
                <Text style={styles.sidebarFooterTitle}>Launch focus</Text>
                <Text style={styles.sidebarFooterText}>
                  Store owners can manage products from the seller portal.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.mainPanel}>
            <View style={styles.topBar}>
              <View style={styles.topBarCopy}>
                <Text numberOfLines={1} style={styles.topBarTitle}>
                  {topBarTitle}
                </Text>
                <Text numberOfLines={1} style={styles.topBarSubtitle}>
                  {topBarSubtitle}
                </Text>
              </View>

              <View style={styles.topBarActions}>
                {!isDispatchUser ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => navigation.navigate('RegisterBusiness')}
                    style={({ pressed }) => [
                      styles.topActionButton,
                      styles.sellActionButton,
                      pressed && styles.topActionButtonPressed,
                    ]}
                  >
                    <Ionicons color={colors.white} name="pricetag-outline" size={20} />
                    <Text style={styles.sellActionText}>Post Ad</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={openNotifications}
                  style={({ pressed }) => [
                    styles.topActionButton,
                    pressed && styles.topActionButtonPressed,
                  ]}
                >
                  <Ionicons color={colors.primary} name="notifications-outline" size={20} />
                  <Text style={styles.topActionText}>Alerts</Text>
                  {unreadNotificationCount > 0 ? (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{unreadNotificationCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
                {!isDispatchUser ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => navigation.navigate('Cart')}
                    style={({ pressed }) => [
                      styles.topActionButton,
                      pressed && styles.topActionButtonPressed,
                    ]}
                  >
                    <Ionicons color={colors.primary} name="cart-outline" size={20} />
                    <Text style={styles.topActionText}>Cart</Text>
                    {cartCount > 0 ? (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{cartCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setShowMenuSheet(true)}
                  style={({ pressed }) => [
                    styles.topActionButton,
                    pressed && styles.topActionButtonPressed,
                  ]}
                >
                  <Ionicons color={colors.primary} name="menu-outline" size={20} />
                  <Text style={styles.topActionText}>Menu</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.desktopContent}>{content}</View>
          </View>
        </View>
      )
    ) : (
      <View style={styles.fullContent}>{framedContent}</View>
    );

  if (passwordRecoveryReady) {
    return <PasswordRecoveryScreen />;
  }

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
        },
      ]}
    >
      {isUrbanConnectLocalTestMode ? (
        <View style={styles.localTestBanner}>
          <Ionicons color={colors.text} name="flask-outline" size={15} />
          <Text style={styles.localTestBannerText}>
            Local test mode - Supabase reads and writes are off
          </Text>
        </View>
      ) : null}

      {appContent}

      {user &&
      !adminUser &&
      !adminWebEntrypoint &&
      !sellerWebEntrypoint &&
      mainRoute !== 'Chats' ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.supportFabHost,
            isMobileLayout && styles.supportFabHostMobile,
            isMobileLayout ? { bottom: 112 + insets.bottom } : null,
          ]}
        >
          <Pressable
            accessibilityLabel="Open customer support"
            accessibilityRole="button"
            onPress={() => {
              setBusinessDetailsId(null);
              setSellerProfileId(null);
              setOrderDetailsId(null);
              setIsCartRoute(false);
              setIsWithdrawalRoute(false);
              setIsTransactionsRoute(false);
              setMainRoute('Chats');
            }}
            style={({ pressed }) => [
              styles.supportFab,
              isMobileLayout && styles.supportFabMobile,
              pressed && styles.supportFabPressed,
            ]}
          >
            <Ionicons color={colors.white} name="headset-outline" size={20} />
            <Text style={styles.supportFabText}>Support</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={showAccessChoice}
        onRequestClose={() => setShowAccessChoice(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.accessChoiceCard}>
            <View style={styles.accessChoiceHeader}>
              <View style={styles.accessChoiceHeaderCopy}>
                <Text style={styles.modalEyebrow}>Choose account type</Text>
                <Text style={[styles.modalTitle, styles.accessChoiceTitle]}>
                  How would you like to continue?
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close account choices"
                onPress={() => setShowAccessChoice(false)}
                style={({ pressed }) => [
                  styles.supportCloseButton,
                  pressed && styles.menuRowPressed,
                ]}
              >
                <Ionicons color={colors.text} name="close-outline" size={22} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setShowAccessChoice(false);
                setAuthRoute('Login');
                setShowGuestAuthPage(true);
              }}
              style={({ pressed }) => [
                styles.accessChoiceOption,
                pressed && styles.menuRowPressed,
              ]}
            >
              <View style={styles.accessChoiceIcon}>
                <Ionicons color={colors.white} name="cart-outline" size={22} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuTitle}>Customer</Text>
                <Text style={styles.menuMeta}>Sign in or create an account to shop.</Text>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
            </Pressable>

            <Pressable
              onPress={() => {
                setShowAccessChoice(false);
                setAuthRoute('DispatchLogin');
                setShowGuestAuthPage(true);
              }}
              style={({ pressed }) => [
                styles.accessChoiceOption,
                styles.accessChoiceOptionDispatch,
                pressed && styles.menuRowPressed,
              ]}
            >
              <View style={[styles.accessChoiceIcon, styles.accessChoiceDispatchIcon]}>
                <Ionicons color={colors.white} name="bicycle-outline" size={22} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuTitle}>Dispatch</Text>
                <Text style={styles.menuMeta}>Sign in as dispatch to manage delivery work.</Text>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
            </Pressable>

            {/* Individual seller option removed — customers can create listings via the List flow */}

            {!sellerToolsBlockedOnMobileWeb ? (
              <>
                <Pressable
                  onPress={() => openWebPath('/business-registration/?sellerType=store')}
                  style={({ pressed }) => [
                    styles.accessChoiceOption,
                    styles.accessChoiceStore,
                    pressed && styles.menuRowPressed,
                  ]}
                >
                  <View style={[styles.accessChoiceIcon, styles.accessChoiceStoreIcon]}>
                    <Ionicons color={colors.white} name="storefront-outline" size={22} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Store owner</Text>
                    <Text style={styles.menuMeta}>Register a store, food business, or established catalog.</Text>
                  </View>
                  <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
                </Pressable>

                <View style={styles.accessChoiceActions}>
                  <AppButton
                    label="Seller login"
                    onPress={() => openWebPath('/seller-portal/')}
                    variant="secondary"
                  />
                </View>
              </>
            ) : (
              <View style={styles.accessChoiceOption}>
                <Text style={styles.menuTitle}>Seller tools are desktop only</Text>
                <Text style={styles.menuMeta}>
                  Seller login and business registration are only available on laptop or desktop.
                  Please use a larger screen to continue.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showGuestAuthPrompt}
        onRequestClose={() => setShowGuestAuthPrompt(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.guestPromptIcon}>
              <Ionicons color={colors.white} name="person-outline" size={24} />
            </View>
            <Text style={styles.modalTitle}>Sign in to continue</Text>
            <Text style={styles.modalBody}>
              Create an account or sign in to add items to your cart, open seller profiles,
              checkout, and track orders.
            </Text>
            <View style={styles.passcodeGateActions}>
              <AppButton
                label="Sign in"
                onPress={() => {
                  setShowGuestAuthPrompt(false);
                  setAuthRoute('Login');
                  setShowGuestAuthPage(true);
                }}
              />
              <AppButton
                label="Create account"
                onPress={() => {
                  setShowGuestAuthPrompt(false);
                  setAuthRoute('Signup');
                  setShowGuestAuthPage(true);
                }}
                variant="secondary"
              />
              <AppButton
                label="Continue shopping"
                onPress={() => setShowGuestAuthPrompt(false)}
                variant="ghost"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showPasscodeGate && Boolean(user) && !adminUser && !journeyOverlay}
        onRequestClose={() => undefined}
      >
        <ScrollView
          contentContainerStyle={styles.passcodeGateBackdrop}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.passcodeGateCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportHeaderIcon}>
                <Ionicons color={colors.white} name="lock-closed-outline" size={22} />
              </View>
              <View style={styles.topBarCopy}>
                <Text style={styles.modalEyebrow}>App passcode</Text>
                <Text style={styles.modalTitle}>Unlock View2Connect</Text>
              </View>
            </View>
            {userSecurityPreference.passcodeEnabled && userSecurityPreference.passcode ? (
              <TextInput
                accessibilityLabel="App passcode"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => {
                  setPasscodeGateDraft(value.replace(/\D/g, '').slice(0, 6));
                  setPasscodeGateError(null);
                }}
                onSubmitEditing={handlePasscodeGateUnlock}
                placeholder="0000"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.passcodeGateInput}
                value={passcodeGateDraft}
              />
            ) : null}
            {passcodeGateError ? (
              <Text style={styles.passcodeGateError}>{passcodeGateError}</Text>
            ) : null}
            <View style={styles.passcodeGateActions}>
              {userSecurityPreference.biometricEnabled ? (
                <AppButton
                  disabled={!isBiometricAvailable || isCheckingBiometric}
                  label={
                    isCheckingBiometric
                      ? `Checking ${biometricLabel}`
                      : `Use ${biometricLabel}`
                  }
                  onPress={() => void handleBiometricGateUnlock()}
                  variant="secondary"
                />
              ) : null}
              {userSecurityPreference.biometricEnabled ? (
                <AppButton
                  label="Turn off biometric lock"
                  onPress={disableBiometricGate}
                  variant="ghost"
                />
              ) : null}
              {userSecurityPreference.passcodeEnabled && userSecurityPreference.passcode ? (
                <AppButton label="Unlock" onPress={handlePasscodeGateUnlock} />
              ) : null}
              <AppButton
                label="Sign out"
                onPress={() => {
                  passcodeUnlockedUserId.current = null;
                  biometricPromptedUserId.current = null;
                  setShowPasscodeGate(false);
                  setPasscodeGateDraft('');
                  setPasscodeGateError(null);
                  signOut();
                }}
                variant="ghost"
              />
            </View>
          </View>
        </ScrollView>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={
          showNotifications &&
          Boolean(user) &&
          !adminUser &&
          !showPasscodeGate &&
          !journeyOverlay
        }
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.notificationModalCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportHeaderIcon}>
                <Ionicons color={colors.white} name="notifications-outline" size={22} />
              </View>
              <View style={styles.topBarCopy}>
                <Text style={styles.modalEyebrow}>Notifications</Text>
                <Text style={styles.modalTitle}>View2Connect updates.</Text>
              </View>
              <Pressable
                onPress={() => setShowNotifications(false)}
                style={({ pressed }) => [styles.supportCloseButton, pressed && styles.menuRowPressed]}
              >
                <Ionicons color={colors.text} name="close-outline" size={22} />
              </Pressable>
            </View>

            <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={false}>
              {modalNotifications.length > 0 ? (
                modalNotifications.map((notification) => (
                  <View key={notification.id} style={styles.notificationModalItem}>
                    <Text style={styles.notificationModalTitle}>{notification.title}</Text>
                    <Text style={styles.notificationModalBody}>{notification.body}</Text>
                    <Text style={styles.notificationModalTime}>
                      {new Date(notification.createdAt).toLocaleString([], {
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.modalBody}>New order and payment updates will appear here.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={
          showLoginAnnouncement &&
          Boolean(user) &&
          !adminUser &&
          !showPasscodeGate &&
          !journeyOverlay
        }
        onRequestClose={() => setShowLoginAnnouncement(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.notificationModalCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportHeaderIcon}>
                <Ionicons color={colors.white} name="megaphone-outline" size={22} />
              </View>
              <View style={styles.topBarCopy}>
                <Text style={styles.modalEyebrow}>{loginAnnouncementAudience} notice</Text>
                <Text style={styles.modalTitle}>
                  {securitySettings.loginAnnouncementTitle}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowLoginAnnouncement(false)}
                style={({ pressed }) => [styles.supportCloseButton, pressed && styles.menuRowPressed]}
              >
                <Ionicons color={colors.text} name="close-outline" size={22} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>{securitySettings.loginAnnouncementBody}</Text>
            <AppButton label="Got it" onPress={() => setShowLoginAnnouncement(false)} />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showMenuSheet && !adminUser && !showPasscodeGate && !journeyOverlay}
        onRequestClose={() => setShowMenuSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Menu</Text>
                <Text style={styles.modalTitle}>View2Connect</Text>
              </View>
              <Pressable
                onPress={() => setShowMenuSheet(false)}
                style={({ pressed }) => [styles.supportCloseButton, pressed && styles.menuRowPressed]}
              >
                <Ionicons color={colors.text} name="close-outline" size={22} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.menuStack}
              showsVerticalScrollIndicator={false}
            >
              {isDispatchUser ? (
                <>
                  <Pressable
                    onPress={() => runMenuAction(() => navigation.navigate('DispatchMode'))}
                    style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                  >
                    <View style={styles.menuIconShell}>
                      <Ionicons color={colors.primary} name="bicycle-outline" size={18} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuTitle}>Dispatch</Text>
                      <Text style={styles.menuMeta}>Open delivery jobs and rider alerts.</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => runMenuAction(() => navigation.navigate('Account'))}
                    style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                  >
                    <View style={styles.menuIconShell}>
                      <Ionicons color={colors.primary} name="person-circle-outline" size={18} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuTitle}>Profile</Text>
                      <Text style={styles.menuMeta}>Open dispatch profile and account details.</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => runMenuAction(() => navigation.navigate('Settings'))}
                    style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                  >
                    <View style={styles.menuIconShell}>
                      <Ionicons color={colors.primary} name="settings-outline" size={18} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuTitle}>Settings</Text>
                      <Text style={styles.menuMeta}>Theme, policy, agreement, and notification settings.</Text>
                    </View>
                  </Pressable>
                </>
              ) : (
                <>
              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('Dashboard'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="home-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Home</Text>
                  <Text style={styles.menuMeta}>Go back to the product shop.</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('Chats'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="chatbubbles-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Messages</Text>
                  <Text style={styles.menuMeta}>Message advertisers and customer care.</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('Food'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="restaurant-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Food</Text>
                  <Text style={styles.menuMeta}>Browse meals, restaurants, snacks, and bakeries.</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('RegisterBusiness'))}
                style={({ pressed }) => [
                  styles.menuRow,
                  styles.menuSellRow,
                  pressed && styles.menuRowPressed,
                ]}
              >
                <View style={[styles.menuIconShell, styles.menuSellIcon]}>
                  <Ionicons color={colors.white} name="pricetag-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Post Advertisement</Text>
                  <Text style={styles.menuMeta}>Create a classified advertisement.</Text>
                </View>
                <Ionicons color={colors.primary} name="chevron-forward" size={18} />
              </Pressable>

              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('Account'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="person-circle-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Profile</Text>
                  <Text style={styles.menuMeta}>Open your account and activity.</Text>
                </View>
              </Pressable>

              {user?.role === 'resident' ? (
                <Pressable
                  onPress={() => runMenuAction(() => navigation.navigate('CustomerBenefits'))}
                  style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                >
                  <View style={styles.menuIconShell}>
                    <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Benefits</Text>
                    <Text style={styles.menuMeta}>Open your customer benefits page.</Text>
                  </View>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('Cart'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="cart-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Cart</Text>
                  <Text style={styles.menuMeta}>Open the full cart page.</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => runMenuAction(() => navigation.navigate('Settings'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="settings-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Settings</Text>
                  <Text style={styles.menuMeta}>Theme, policy, and agreement.</Text>
                </View>
              </Pressable>

              <View style={styles.socialShareSection}>
                <View>
                  <Text style={styles.menuTitle}>Share View2Connect</Text>
                  <Text style={styles.menuMeta}>Invite customers and sellers.</Text>
                </View>
                <View style={styles.socialShareRow}>
                  {socialShareLinks.map((link) => (
                    <Pressable
                      accessibilityLabel={`Share on ${link.label}`}
                      accessibilityRole="button"
                      key={link.label}
                      onPress={() => openSocialShare(link.url)}
                      style={({ pressed }) => [
                        styles.socialShareButton,
                        pressed && styles.menuRowPressed,
                      ]}
                    >
                      <Ionicons color={colors.primary} name={link.icon} size={20} />
                    </Pressable>
                  ))}
                </View>
              </View>
                </>
              )}

            </ScrollView>

            <Pressable
              onPress={() => {
                setShowMenuSheet(false);
                signOut();
              }}
              style={({ pressed }) => [
                styles.menuFooterRow,
                pressed && styles.menuRowPressed,
              ]}
            >
              <Ionicons color={colors.danger} name="log-out-outline" size={18} />
              <Text style={styles.menuFooterText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {journeyOverlay ? (
        width < 800 && (journeyOverlay.mode === 'opening' || journeyOverlay.mode === 'resident') ? (
          <MobileCustomerJourney
            {...(journeyOverlay.firstName ? { firstName: journeyOverlay.firstName } : {})}
            key={journeyOverlay.key}
            mode={journeyOverlay.mode}
            onComplete={completeJourneyAnimation}
          />
        ) : (
          <MarketplaceJourneyAnimation
            {...(journeyOverlay.firstName ? { firstName: journeyOverlay.firstName } : {})}
            key={journeyOverlay.key}
            mode={journeyOverlay.mode}
            onComplete={completeJourneyAnimation}
          />
        )
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    localTestBanner: {
      position: 'absolute',
      top: spacing.xs,
      left: spacing.sm,
      right: spacing.sm,
      zIndex: 50,
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.accent,
      paddingHorizontal: spacing.md,
    },
    localTestBannerText: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '800',
      textAlign: 'center',
    },
    adminMobileBlocked: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    adminMobileBlockedCard: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.card,
    },
    adminMobileBlockedTitle: {
      ...typography.subtitle,
      color: colors.text,
      textAlign: 'center',
    },
    adminMobileBlockedText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
    desktopShell: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    mobileShell: {
      flex: 1,
      position: 'relative',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    mobileContent: {
      flex: 1,
      minHeight: 0,
      position: 'relative',
    },
    sidebar: {
      width: 248,
      borderRadius: radii.xl,
      backgroundColor:
        colors.surface === colors.white ? 'rgba(255,255,255,0.92)' : 'rgba(15,32,40,0.94)',
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      justifyContent: 'space-between',
      ...shadows.card,
    },
    sidebarCompact: {
      width: 94,
      paddingHorizontal: spacing.sm,
    },
    sidebarTop: {
      gap: spacing.lg,
    },
    brandShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    brandIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
    },
    brandCopy: {
      gap: 2,
    },
    brandTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    brandText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    sidebarNav: {
      gap: spacing.sm,
    },
    sidebarButton: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sidebarButtonCompact: {
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    sidebarButtonActive: {
      backgroundColor: colors.card,
    },
    sidebarButtonPressed: {
      opacity: 0.92,
    },
    sidebarIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
    },
    sidebarIconShellActive: {
      backgroundColor: colors.primarySoft,
    },
    sidebarLabel: {
      ...typography.bodyStrong,
      color: colors.textMuted,
    },
    sidebarLabelActive: {
      color: colors.primary,
    },
    sidebarFooter: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    sidebarFooterTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    sidebarFooterText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    mainPanel: {
      flex: 1,
      gap: spacing.md,
    },
    desktopContent: {
      flex: 1,
    },
    fullContent: {
      flex: 1,
    },
    guestStoreShell: {
      flex: 1,
      minHeight: 0,
      gap: spacing.md,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    guestStoreHeader: {
      width: '100%',
      maxWidth: 1280,
      minHeight: 70,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.md,
    },
    guestStoreHeaderMobile: {
      minHeight: 0,
      alignItems: 'stretch',
      flexDirection: 'column',
    },
    guestBrandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    cacBadge: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
    },
    cacBadgeText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    guestSocialRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    guestSocialButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    guestStoreNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    guestStoreNavMobile: {
      width: '100%',
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
      gap: 0,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
    },
    guestNavButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
    },
    guestNavButtonActive: {
      backgroundColor: colors.primarySoft,
    },
    guestNavButtonMobile: {
      flexGrow: 1,
      flexBasis: '20%',
      minHeight: 52,
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 2,
      borderRadius: 8,
      paddingHorizontal: 4,
    },
    guestNavText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    guestSellButton: {
      backgroundColor: colors.primary,
    },
    guestSellText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    guestIconButton: {
      height: 42,
      width: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    guestSignInButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
    },
    guestSignInText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    guestSignInButtonMobile: {
      flexGrow: 1,
      flexBasis: '20%',
      minHeight: 52,
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 2,
      borderRadius: 8,
      backgroundColor: 'transparent',
      paddingHorizontal: 4,
    },
    guestSignInTextMobile: {
      color: colors.primary,
    },
    guestStoreContent: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: 1280,
      alignSelf: 'center',
    },
    authWebStage: {
      flex: 1,
      width: '100%',
      backgroundColor: '#160F25',
    },
    authWebStageWide: {
      width: '100%',
    },
    authWebFrame: {
      flex: 1,
      width: '100%',
      maxWidth: '100%',
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      shadowOpacity: 0,
      elevation: 0,
    },
    authWebFrameWide: {
      maxWidth: '100%',
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 10,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor:
        colors.surface === colors.white ? 'rgba(255,255,255,0.92)' : 'rgba(15,32,40,0.94)',
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...shadows.soft,
      elevation: 10,
    },
    topBarCopy: {
      flex: 1,
      gap: 2,
    },
    topBarTitle: {
      ...typography.section,
      color: colors.text,
    },
    topBarSubtitle: {
      ...typography.caption,
      color: colors.textMuted,
    },
    topBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    topActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    topActionButtonPressed: {
      opacity: 0.92,
    },
    topActionText: {
      ...typography.caption,
      color: colors.primary,
    },
    sellActionButton: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    sellActionText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    cartBadge: {
      minWidth: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    cartBadgeText: {
      ...typography.caption,
      color: colors.white,
    },
    supportFabHost: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xxl,
      zIndex: 40,
      elevation: 40,
    },
    supportFab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      ...shadows.card,
    },
    supportFabHostMobile: {
      right: spacing.md,
    },
    supportFabMobile: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    supportFabPressed: {
      opacity: 0.9,
      transform: [{ translateY: 1 }],
    },
    supportFabText: {
      ...typography.subtitle,
      color: colors.white,
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      position: 'relative',
      zIndex: 10,
      gap: spacing.xs,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor:
        colors.surface === colors.white ? 'rgba(255,255,255,0.96)' : 'rgba(15,32,40,0.96)',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
      ...shadows.card,
      elevation: 10,
    },
    bottomButton: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      borderRadius: radii.lg,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    bottomButtonActive: {
      backgroundColor: colors.card,
    },
    bottomButtonPressed: {
      opacity: 0.92,
    },
    bottomIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      width: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
    },
    bottomIconShellActive: {
      backgroundColor: colors.primarySoft,
    },
    bottomLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    bottomLabelActive: {
      color: colors.primary,
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
    },
    passcodeGateBackdrop: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
      paddingVertical: spacing.xxl,
    },
    modalCard: {
      width: '100%',
      maxWidth: 440,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.card,
    },
    guestPromptIcon: {
      height: 48,
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: colors.primary,
    },
    accessChoiceCard: {
      width: '100%',
      maxWidth: 560,
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.card,
    },
    accessChoiceHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginBottom: spacing.xs,
    },
    accessChoiceHeaderCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    accessChoiceTitle: {
      fontSize: 20,
      lineHeight: 26,
    },
    accessChoiceOption: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    accessChoiceIndividual: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    accessChoiceStore: {
      borderColor: colors.secondary,
      backgroundColor: colors.secondarySoft,
    },
    accessChoiceOptionDispatch: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    accessChoiceIcon: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    accessChoiceIndividualIcon: {
      backgroundColor: colors.primary,
    },
    accessChoiceStoreIcon: {
      backgroundColor: colors.secondary,
    },
    accessChoiceDispatchIcon: {
      backgroundColor: colors.accent,
    },
    accessChoiceActions: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    passcodeGateCard: {
      width: '100%',
      maxWidth: 420,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    passcodeGateInput: {
      minHeight: 58,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
      paddingHorizontal: spacing.lg,
      textAlign: 'center',
      ...typography.title,
    },
    passcodeGateError: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'center',
    },
    passcodeGateActions: {
      gap: spacing.sm,
    },
    modalEyebrow: {
      ...typography.eyebrow,
      color: colors.primary,
    },
    modalTitle: {
      ...typography.title,
      color: colors.text,
    },
    modalBody: {
      ...typography.body,
      color: colors.textMuted,
    },
    modalButton: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    modalButtonPressed: {
      opacity: 0.92,
    },
    modalButtonText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    supportCard: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '82%',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    notificationModalCard: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '82%',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    notificationList: {
      maxHeight: 420,
    },
    notificationModalItem: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
      padding: spacing.md,
    },
    notificationModalTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    notificationModalBody: {
      ...typography.body,
      color: colors.textMuted,
    },
    notificationModalTime: {
      ...typography.caption,
      color: colors.primary,
    },
    supportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    supportHeaderIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
    },
    supportCloseButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      width: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    supportMessages: {
      maxHeight: 360,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    supportMessageRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    supportMessageRowUser: {
      justifyContent: 'flex-end',
    },
    supportMessageRowCare: {
      justifyContent: 'flex-start',
    },
    supportBubble: {
      maxWidth: '82%',
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    supportBubbleUser: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    supportBubbleCare: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    supportBubbleText: {
      ...typography.body,
      color: colors.white,
    },
    supportBubbleTextCare: {
      color: colors.text,
    },
    supportComposer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    supportInput: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
      paddingHorizontal: spacing.md,
      ...typography.body,
    },
    supportSendButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      width: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      ...shadows.soft,
    },
    menuCard: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '84%',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.card,
    },
    menuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    menuStack: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    menuRowPressed: {
      opacity: 0.9,
    },
    menuSellRow: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    menuIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.primarySoft,
    },
    menuSellIcon: {
      backgroundColor: colors.primary,
    },
    menuCopy: {
      flex: 1,
      gap: 4,
    },
    menuTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    menuMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    socialShareSection: {
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    socialShareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    socialShareButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primarySoft,
    },
    menuFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    menuFooterText: {
      ...typography.bodyStrong,
      color: colors.danger,
    },
  });
}
