import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
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
import { UrbanConnectLogo } from '../components/UrbanConnectLogo';
import { AccountScreen } from '../screens/AccountScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminPanelScreen } from '../screens/AdminPanelScreen';
import { BusinessDetailsScreen } from '../screens/BusinessDetailsScreen';
import { CartScreen } from '../screens/CartScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OrderDetailsScreen } from '../screens/OrderDetailsScreen';
import { ProfessionsScreen } from '../screens/ProfessionsScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { RegisterBusinessScreen } from '../screens/RegisterBusinessScreen';
import { SellerProfileScreen } from '../screens/SellerProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { WithdrawalScreen } from '../screens/WithdrawalScreen';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { getOrderStatusLabel } from '../utils/order';
import type { AppNavigation, MainTabParamList } from './types';

type AuthRoute = 'Login' | 'Signup' | 'AdminLogin';
type MainRoute = keyof MainTabParamList;
type IconName = keyof typeof Ionicons.glyphMap;

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
    title: 'River Park shop',
    subtitle: 'Buy approved products from businesses inside River Park.',
  },
  Professions: {
    icon: 'briefcase-outline',
    label: 'Services',
    title: 'River Park services',
    subtitle: 'Find approved local services and use customer care for help.',
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
    subtitle: 'Manage business subscription payment and River Park verification.',
  },
  Chats: {
    icon: 'headset-outline',
    label: 'Support',
    title: 'Customer care',
    subtitle: 'Message UrbanConnect customer care.',
  },
  Account: {
    icon: 'person-circle-outline',
    label: 'Profile',
    title: 'Account',
    subtitle: 'Manage orders, listings, and River Park profile details.',
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

export function AppNavigator() {
  const {
    adminUser,
    findUserById,
    signOut,
    signOutAdmin,
    user,
    userSecurityPreference,
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
  } = useBusinessDirectory();
  const [authRoute, setAuthRoute] = useState<AuthRoute>('Login');
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
        promptMessage: 'Unlock UrbanConnect',
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
      setAuthRoute('Login');
      setMainRoute('Dashboard');
      setBusinessDetailsId(null);
      setIsCartRoute(false);
      setIsWithdrawalRoute(false);
      setIsTransactionsRoute(false);
      setSellerProfileId(null);
      setOrderDetailsId(null);
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

    if (
      user.role !== 'businessOwner' &&
      (mainRoute === 'RegisterBusiness' || mainRoute === 'Subscription')
    ) {
      setMainRoute('Dashboard');
    }
  }, [mainRoute, user]);

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

    if (!userSecurityPreference.passcodeEnabled || !userSecurityPreference.passcode) {
      setShowPasscodeGate(false);
      setPasscodeGateDraft('');
      setPasscodeGateError(null);
      passcodeUnlockedUserId.current = user.id;
      biometricPromptedUserId.current = null;
      passcodePreferenceSignature.current = `${user.id}:none`;
      return;
    }

    const currentPreferenceSignature = `${user.id}:${userSecurityPreference.passcode}:${userSecurityPreference.updatedAt}`;
    if (passcodePreferenceSignature.current !== currentPreferenceSignature) {
      const updatedAt = Date.parse(userSecurityPreference.updatedAt);
      const changedDuringCurrentSession =
        passcodeUnlockedUserId.current === user.id &&
        Number.isFinite(updatedAt) &&
        Date.now() - updatedAt < 5000;

      if (!changedDuringCurrentSession) {
        passcodeUnlockedUserId.current = null;
      }

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
    userSecurityPreference.passcode,
    userSecurityPreference.passcodeEnabled,
    userSecurityPreference.updatedAt,
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
        if (screen === 'Login' || screen === 'Signup' || screen === 'AdminLogin') {
          setAuthRoute(screen);
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
          if (user?.role !== 'businessOwner') {
            setBusinessDetailsId(null);
            setSellerProfileId(null);
            setOrderDetailsId(null);
            setIsCartRoute(false);
            setIsWithdrawalRoute(false);
            setIsTransactionsRoute(false);
            setMainRoute('Account');
            return;
          }

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
          screen === 'Professions' ||
          screen === 'RegisterBusiness' ||
          screen === 'Subscription' ||
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
          setMainRoute(screen);
        }
      }) as AppNavigation['navigate'],
      replace: ((
        screen: 'OrderDetails' | 'BusinessDetails' | 'SellerProfile',
        params: { businessId: string } | { userId: string } | { orderId: string },
      ) => {
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
      sellerProfileId,
      user,
    ],
  );

  let content: React.ReactNode;

  const handleReturnToApp = () => {
    signOutAdmin();
    setAuthRoute('Login');
  };

  if (adminUser) {
    content = <AdminPanelScreen onReturnToApp={handleReturnToApp} />;
  } else if (!user) {
    content =
      authRoute === 'AdminLogin' ? (
        <AdminLoginScreen navigation={navigation} />
      ) : authRoute === 'Signup' ? (
        <SignupScreen navigation={navigation} />
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
  } else if (mainRoute === 'Professions') {
    content = <ProfessionsScreen navigation={navigation} />;
  } else if (mainRoute === 'RegisterBusiness' && user.role === 'businessOwner') {
    content = <RegisterBusinessScreen navigation={navigation} />;
  } else if (mainRoute === 'Subscription' && user.role === 'businessOwner') {
    content = <SubscriptionScreen navigation={navigation} />;
  } else if (mainRoute === 'Chats') {
    content = <ChatsScreen navigation={navigation} />;
  } else if (mainRoute === 'ProfileEdit') {
    content = <ProfileEditScreen navigation={navigation} />;
  } else if (mainRoute === 'Settings') {
    content = <SettingsScreen navigation={navigation} />;
  } else if (mainRoute === 'Account') {
    content = <AccountScreen navigation={navigation} />;
  } else {
    content = <DashboardScreen navigation={navigation} />;
  }

  const isMobileLayout = width < 780;
  const compactSidebar = width < 980;
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
      ? 'Product details inside River Park'
      : 'Profession profile inside River Park'
    : activeSeller
      ? `${activeSeller.firstName}'s approved River Park business profile.`
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
  useEffect(() => {
    const previousIds = new Set(previousUnreadIds.current);
    const newUnreadNotifications = unreadNotifications.filter(
      (notification) => !previousIds.has(notification.id),
    );

    if (unreadNotificationCount > previousUnreadCount.current) {
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

    previousUnreadCount.current = unreadNotificationCount;
    previousUnreadIds.current = unreadNotifications.map((notification) => notification.id);
  }, [adminUser, markNotificationsRead, unreadNotifications, unreadNotificationCount, user]);
  const openNotifications = () => {
    setOpenNotificationIds(unreadNotifications.map((notification) => notification.id));
    setShowNotifications(true);

    if (user) {
      markNotificationsRead(user.id);
    }
  };
  const openSupportChat = () => {
    setBusinessDetailsId(null);
    setSellerProfileId(null);
    setOrderDetailsId(null);
    setIsCartRoute(false);
    setIsWithdrawalRoute(false);
    setIsTransactionsRoute(false);
    setMainRoute('Chats');
  };
  const handlePasscodeGateUnlock = () => {
    const cleanedPasscode = passcodeGateDraft.replace(/\D/g, '').slice(0, 6);

    if (cleanedPasscode !== userSecurityPreference.passcode) {
      setPasscodeGateError('Passcode is incorrect.');
      return;
    }

    unlockPasscodeGate();
  };

  const appContent =
    user && !adminUser ? (
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

          <View style={styles.mobileContent}>{content}</View>

          <View style={styles.bottomBar}>
            <NavButton
              active={mainRoute === 'Dashboard'}
              icon={routeMeta.Dashboard.icon}
              label={routeMeta.Dashboard.label}
              onPress={() => navigation.navigate('Dashboard')}
              placement="bottom"
            />
            <NavButton
              active={mainRoute === 'Professions'}
              icon={routeMeta.Professions.icon}
              label={routeMeta.Professions.label}
              onPress={() => navigation.navigate('Professions')}
              placement="bottom"
            />
            {user.role === 'businessOwner' ? (
              <NavButton
                active={mainRoute === 'RegisterBusiness'}
                icon={routeMeta.RegisterBusiness.icon}
                label={routeMeta.RegisterBusiness.label}
                onPress={() => navigation.navigate('RegisterBusiness')}
                placement="bottom"
              />
            ) : null}
            {user.role === 'businessOwner' ? (
              <NavButton
                active={mainRoute === 'Subscription'}
                icon={routeMeta.Subscription.icon}
                label={routeMeta.Subscription.label}
                onPress={() => navigation.navigate('Subscription')}
                placement="bottom"
              />
            ) : null}
            <NavButton
              active={mainRoute === 'Account'}
              icon={routeMeta.Account.icon}
              label={routeMeta.Account.label}
              onPress={() => navigation.navigate('Account')}
              placement="bottom"
            />
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
                <NavButton
                  active={mainRoute === 'Dashboard'}
                  compact={compactSidebar}
                  icon={routeMeta.Dashboard.icon}
                  label={routeMeta.Dashboard.label}
                  onPress={() => navigation.navigate('Dashboard')}
                  placement="sidebar"
                />
                <NavButton
                  active={mainRoute === 'Professions'}
                  compact={compactSidebar}
                  icon={routeMeta.Professions.icon}
                  label={routeMeta.Professions.label}
                  onPress={() => navigation.navigate('Professions')}
                  placement="sidebar"
                />
                {user.role === 'businessOwner' ? (
                  <NavButton
                    active={mainRoute === 'RegisterBusiness'}
                    compact={compactSidebar}
                    icon={routeMeta.RegisterBusiness.icon}
                    label={routeMeta.RegisterBusiness.label}
                    onPress={() => navigation.navigate('RegisterBusiness')}
                    placement="sidebar"
                  />
                ) : null}
                {user.role === 'businessOwner' ? (
                  <NavButton
                    active={mainRoute === 'Subscription'}
                    compact={compactSidebar}
                    icon={routeMeta.Subscription.icon}
                    label={routeMeta.Subscription.label}
                    onPress={() => navigation.navigate('Subscription')}
                    placement="sidebar"
                  />
                ) : null}
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
              </View>
            </View>

            {!compactSidebar ? (
              <View style={styles.sidebarFooter}>
                <Text style={styles.sidebarFooterTitle}>Launch focus</Text>
                <Text style={styles.sidebarFooterText}>
                  Shops and service providers are limited to River Park for this rollout.
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
      <View style={styles.fullContent}>{content}</View>
    );

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
      {appContent}

      {user && !adminUser ? (
        <Pressable
          onPress={openSupportChat}
          style={({ pressed }) => [
            styles.supportFabHost,
            isMobileLayout && styles.supportFabMobile,
            styles.supportFab,
            pressed && styles.supportFabPressed,
          ]}
        >
          <Ionicons color={colors.white} name="headset-outline" size={24} />
          <Text style={styles.supportFabText}>Care</Text>
        </Pressable>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={showPasscodeGate && Boolean(user) && !adminUser}
        onRequestClose={() => undefined}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.passcodeGateCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportHeaderIcon}>
                <Ionicons color={colors.white} name="lock-closed-outline" size={22} />
              </View>
              <View style={styles.topBarCopy}>
                <Text style={styles.modalEyebrow}>App passcode</Text>
                <Text style={styles.modalTitle}>Unlock UrbanConnect</Text>
              </View>
            </View>
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
              <AppButton label="Unlock" onPress={handlePasscodeGateUnlock} />
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
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showNotifications && Boolean(user) && !adminUser && !showPasscodeGate}
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
                <Text style={styles.modalTitle}>UrbanConnect updates.</Text>
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
        visible={showLoginAnnouncement && Boolean(user) && !adminUser && !showPasscodeGate}
        onRequestClose={() => setShowLoginAnnouncement(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.notificationModalCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportHeaderIcon}>
                <Ionicons color={colors.white} name="megaphone-outline" size={22} />
              </View>
              <View style={styles.topBarCopy}>
                <Text style={styles.modalEyebrow}>UrbanConnect notice</Text>
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
        visible={showMenuSheet && !adminUser && !showPasscodeGate}
        onRequestClose={() => setShowMenuSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Menu</Text>
                <Text style={styles.modalTitle}>UrbanConnect</Text>
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
                onPress={() => runMenuAction(() => navigation.navigate('Professions'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="briefcase-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Services</Text>
                  <Text style={styles.menuMeta}>Browse approved local services.</Text>
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
                  <Text style={styles.menuMeta}>Open your account and activity.</Text>
                </View>
              </Pressable>

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
                onPress={() => runMenuAction(() => navigation.navigate('Chats'))}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <View style={styles.menuIconShell}>
                  <Ionicons color={colors.primary} name="headset-outline" size={18} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Customer care</Text>
                  <Text style={styles.menuMeta}>Message UrbanConnect support.</Text>
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

              {user?.role === 'businessOwner' ? (
                <Pressable
                  onPress={() => runMenuAction(() => navigation.navigate('RegisterBusiness'))}
                  style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                >
                  <View style={styles.menuIconShell}>
                    <Ionicons color={colors.primary} name="add-outline" size={18} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Create listing</Text>
                    <Text style={styles.menuMeta}>Publish a product or service.</Text>
                  </View>
                </Pressable>
              ) : null}
              {user?.role === 'businessOwner' ? (
                <Pressable
                  onPress={() => runMenuAction(() => navigation.navigate('Subscription'))}
                  style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                >
                  <View style={styles.menuIconShell}>
                    <Ionicons color={colors.primary} name="card-outline" size={18} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Subscription</Text>
                    <Text style={styles.menuMeta}>Pay from account balance and review status.</Text>
                  </View>
                </Pressable>
              ) : null}
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
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
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
      zIndex: 7,
      elevation: 7,
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
    supportFabMobile: {
      right: spacing.md,
      bottom: 126,
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
    menuIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.primarySoft,
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
