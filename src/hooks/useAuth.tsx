import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { isUrbanConnectLocalTestMode } from '../config/runtime';
import { localTestUsers } from '../data/localTestUsers';
import { seededAdminUsers } from '../data/mockAdmins';
import { useBusinessDirectory } from './useBusinessDirectory';
import type {
  AdminPermission,
  AdminSignInFormValues,
  AdminUser,
  AppUser,
  SignInFormValues,
  SignUpFormValues,
  StoredAdminUser,
  StoredUser,
  UserSecurityPreference,
  UserStatus,
} from '../types/auth';
import { riverParkClusters } from '../types/business';
import { canAdminEditSensitiveData, isUserActive } from '../utils/businessState';
import { usePersistentState } from './usePersistentState';
import { useSecureSupabaseSession } from './useSecureSupabaseSession';
import {
  addOAuthContextToCallbackUrl,
  completeSupabaseOAuth,
  createDispatchAccountWithSupabase,
  fetchMySupabaseAdmin,
  fetchSupabaseUserProfiles,
  isRecoverableSupabaseSetupError,
  isSupabaseConfigured,
  refreshSupabaseSession,
  setSupabaseAccessToken,
  setRiverParkVerificationInSupabase,
  sendSupabaseSignupVerificationCode,
  signInWithSupabase,
  signOutSupabase,
  signUpWithSupabase,
  syncSupabaseSessionProfile,
  updateSupabaseAuthPassword,
  updateSupabaseUserProfile,
  verifySupabaseAdmin,
} from '../services/supabaseApi';

type AuthContextValue = {
  user: AppUser | null;
  users: AppUser[];
  supabaseAccessToken?: string;
  adminUser: AdminUser | null;
  adminUsers: AdminUser[];
  signIn: (values: SignInFormValues) => Promise<void>;
  requestSignUpVerification: (values: SignUpFormValues) => Promise<void>;
  signUp: (values: SignUpFormValues, verificationCode: string) => Promise<void>;
  beginSocialSignIn: (webRedirectPath?: string) => void;
  completeSocialSignIn: (callbackUrl: string | null) => Promise<boolean>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
  userSecurityPreference: UserSecurityPreference;
  updateUserSecurityPreference: (patch: Partial<UserSecurityPreference>) => void;
  resetPassword: (identifier: string, nextPassword: string) => Promise<'user' | 'admin'>;
  passwordRecoveryReady: boolean;
  completePasswordRecovery: (nextPassword: string) => Promise<void>;
  cancelPasswordRecovery: () => void;
  signOut: () => void;
  signInAdmin: (values: AdminSignInFormValues) => Promise<void>;
  signOutAdmin: () => void;
  setAdminAccountActive: (
    adminId: string,
    isActive: boolean,
    actorName?: string,
    actorRole?: AdminUser['role'],
  ) => void;
  createCustomerCareAccount: (
    values: {
      fullName: string;
      email: string;
      password: string;
    },
    actorName?: string,
    actorRole?: AdminUser['role'],
  ) => AdminUser;
  createDispatchAccount: (
    values: {
      fullName: string;
      email: string;
      phoneNumber: string;
      password: string;
      estateId: string;
      businessCluster?: string;
      adminEmail?: string;
      adminPassword?: string;
    },
    actorName?: string,
    actorRole?: AdminUser['role'],
  ) => Promise<AppUser>;
  updateAdminPassword: (
    adminId: string,
    nextPassword: string,
    actorName?: string,
    actorRole?: AdminUser['role'],
    actorAdminId?: string,
  ) => void;
  setUserStatus: (
    userId: string,
    status: UserStatus,
    actorName?: string,
    actorRole?: AdminUser['role'],
  ) => void;
  setUserRiverParkVerification: (
    userId: string,
    verified: boolean,
    actorName?: string,
    actorRole?: AdminUser['role'],
  ) => void;
  findUserById: (userId: string) => AppUser | undefined;
  hasAdminPermission: (permission: AdminPermission) => boolean;
};

type UserProfileOverride = {
  riverParkVerified?: boolean;
  status?: UserStatus;
  updatedAt: string;
};

const defaultUserSecurityPreference: UserSecurityPreference = {
  biometricEnabled: false,
  passcodeEnabled: false,
  passcode: '',
  notificationsEnabled: true,
  orderNotificationsEnabled: true,
  updatedAt: '',
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppUser(user: StoredUser): AppUser {
  const { password: _password, ...appUser } = user;
  return appUser;
}

function toAdminUser(user: StoredAdminUser): AdminUser {
  const { password: _password, ...adminUser } = user;
  return adminUser;
}

function normalizePhoneNumber(value: string) {
  return (value ?? '').replace(/[^\d+]/g, '');
}

function normalizeSignInIdentifier(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.includes('@')
    ? trimmedValue.toLowerCase()
    : normalizePhoneNumber(trimmedValue);
}

function authRoleLabel(role: AppUser['role']) {
  if (role === 'businessOwner') {
    return 'store owner';
  }

  if (role === 'dispatch') {
    return 'dispatch';
  }

  return 'customer';
}

function roleConflictMessage(
  existingRole: AppUser['role'],
  requestedRole: AppUser['role'],
  identifierLabel: 'email' | 'phone number' = 'email',
) {
  if (existingRole === requestedRole) {
    return `A ${authRoleLabel(requestedRole)} account with that ${identifierLabel} already exists.`;
  }

  return `This ${identifierLabel} is already used by a separate ${authRoleLabel(
    existingRole,
  )} account. You can create an isolated ${authRoleLabel(
    requestedRole,
  )} account with the same ${identifierLabel}, but use the ${authRoleLabel(
    requestedRole,
  )} login for that role.`;
}

function normalizeSignupVerificationError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Unable to send the verification code right now.';

  if (/verification email could not be sent|verification code could not be sent/i.test(message)) {
    return 'Verification code could not be sent because View2Connect email delivery is not fully configured. Please contact support.';
  }

  return message;
}

function migrateStoredUser(user: StoredUser): StoredUser {
  const nameParts =
    typeof user.fullName === 'string' && user.fullName.trim().length > 0
      ? user.fullName.trim().split(' ')
      : [];
  const firstName =
    user.firstName?.trim() || nameParts[0] || user.email.split('@')[0] || 'Urban';
  const lastName =
    user.lastName?.trim() || nameParts.slice(1).join(' ') || (user.role === 'businessOwner' ? 'Seller' : 'Resident');

  return {
    ...user,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    phoneNumber: user.phoneNumber?.trim() || `+234${String(user.id).replace(/\D/g, '').slice(0, 10).padEnd(10, '0')}`,
    riverParkVerified:
      user.riverParkVerified ?? (user.role === 'resident' || user.role === 'businessOwner'),
    status: user.status ?? 'active',
    ...(user.businessName ? { businessName: user.businessName } : {}),
    ...(user.businessCluster ? { businessCluster: user.businessCluster } : {}),
  };
}

function migrateAppUser(user: AppUser): AppUser {
  return toAppUser(migrateStoredUser({ ...user, password: '' }));
}

function normalizeAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

const ownerPermissions: AdminPermission[] = [
  'exportUsers',
  'exportListings',
  'verifyListings',
  'deleteListings',
];

const customerCarePermissions: AdminPermission[] = ['verifyListings'];
const delegatedAdminPermissions: AdminPermission[] = [
  'exportUsers',
  'exportListings',
  'verifyListings',
  'deleteListings',
];

function getAdminPermissions(role: AdminUser['role'] | undefined) {
  if (role === 'owner') {
    return ownerPermissions;
  }

  if (role === 'customerCare') {
    return customerCarePermissions;
  }

  if (role === 'admin') {
    return delegatedAdminPermissions;
  }

  return [];
}

export function AuthProvider({ children }: PropsWithChildren) {
  const {
    appendAuditLog,
    appendNotification,
    notifyBusinessOwnerInspection,
    securitySettings,
  } = useBusinessDirectory();
  const [rawStoredUsers, setStoredUsers] = usePersistentState<StoredUser[]>(
    'urbanconnect.users.v2',
    isUrbanConnectLocalTestMode ? localTestUsers : [],
    { enabled: isUrbanConnectLocalTestMode },
  );
  const [storedAdminUsers, setStoredAdminUsers] = usePersistentState<StoredAdminUser[]>(
    'urbanconnect.adminUsers.v1',
    isUrbanConnectLocalTestMode ? seededAdminUsers : [],
    { enabled: isUrbanConnectLocalTestMode },
  );
  const [rawUser, setUser] = usePersistentState<AppUser | null>(
    'urbanconnect.currentUser.v2',
    null,
    { enabled: isUrbanConnectLocalTestMode },
  );
  const [rawAdminUser, setAdminUser] = usePersistentState<AdminUser | null>(
    'urbanconnect.currentAdmin.v1',
    null,
    { enabled: isUrbanConnectLocalTestMode },
  );
  const [supabaseSession, setSupabaseSession, isSessionHydrated] = useSecureSupabaseSession();
  const oauthCallbackHandledRef = useRef(false);
  const [passwordRecoveryReady, setPasswordRecoveryReady] = useState(false);
  const oauthCallbackUrlRef = useRef<string | null>(null);
  const pendingOAuthRedirectPathRef = useRef<string | undefined>(undefined);
  const syncedProfileSessionRef = useRef<string | null>(null);
  const [userProfileOverrides, setUserProfileOverrides] = usePersistentState<
    Record<string, UserProfileOverride>
  >('urbanconnect.userProfileOverrides.v1', {}, { enabled: false });
  const [userSecurityPreferencesByUser, setUserSecurityPreferencesByUser] = usePersistentState<
    Record<string, UserSecurityPreference>
  >('urbanconnect.userSecurityPreferences.v1', {}, { enabled: false });
  const storedUsers = useMemo(() => rawStoredUsers.map(migrateStoredUser), [rawStoredUsers]);
  const user = useMemo(() => (rawUser ? migrateAppUser(rawUser) : null), [rawUser]);
  const userSecurityPreference = useMemo(
    () =>
      user
        ? {
            ...defaultUserSecurityPreference,
            ...(userSecurityPreferencesByUser[user.id] ?? {}),
          }
        : defaultUserSecurityPreference,
    [user, userSecurityPreferencesByUser],
  );
  const adminUsers = useMemo(() => storedAdminUsers.map(toAdminUser), [storedAdminUsers]);
  const adminUser = useMemo(() => {
    if (!rawAdminUser) {
      return null;
    }

    const matchedAdmin = storedAdminUsers.find((item) => item.id === rawAdminUser.id);

    if (matchedAdmin && !matchedAdmin.isActive) {
      return null;
    }

    return matchedAdmin ? toAdminUser(matchedAdmin) : rawAdminUser;
  }, [rawAdminUser, storedAdminUsers]);

  useEffect(() => {
    setSupabaseAccessToken(supabaseSession?.accessToken);

    return () => setSupabaseAccessToken(undefined);
  }, [supabaseSession?.accessToken]);

  useEffect(() => {
    if (rawAdminUser && !adminUser) {
      setAdminUser(null);
    }
  }, [adminUser, rawAdminUser, setAdminUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || !adminUser || !supabaseSession?.accessToken) {
      return undefined;
    }

    let isCancelled = false;

    const loadProfiles = () => {
      fetchSupabaseUserProfiles()
        .then((remoteUsers) => {
          if (!isCancelled) {
            setStoredUsers((currentUsers) => {
              const remoteIds = new Set(remoteUsers.map((remoteUser) => remoteUser.id));
              const currentUsersById = new Map(
                currentUsers.map((currentUser) => [currentUser.id, currentUser]),
              );
              const remoteUsersWithOverrides = remoteUsers.map((remoteUser) => {
                const override = userProfileOverrides[remoteUser.id];
                const currentUser = currentUsersById.get(remoteUser.id);
                const remoteUserWithCachedPassword = currentUser?.password
                  ? { ...remoteUser, password: currentUser.password }
                  : remoteUser;

                if (!override) {
                  return remoteUserWithCachedPassword;
                }

                return {
                  ...remoteUserWithCachedPassword,
                  ...(override.riverParkVerified !== undefined
                    ? { riverParkVerified: override.riverParkVerified }
                    : {}),
                  ...(override.status ? { status: override.status } : {}),
                };
              });
              const localOnlyUsers = currentUsers.filter(
                (currentUser) => !remoteIds.has(currentUser.id),
              );

              return [...remoteUsersWithOverrides, ...localOnlyUsers];
            });
          }
        })
        .catch(() => {
          // Keep the local cache usable when the Supabase project has not been seeded yet.
        });
    };

    loadProfiles();
    const refreshInterval = setInterval(loadProfiles, 30_000);

    return () => {
      isCancelled = true;
      clearInterval(refreshInterval);
    };
  }, [adminUser, setStoredUsers, supabaseSession?.accessToken, userProfileOverrides]);

  useEffect(() => {
    if (!rawUser) {
      return;
    }

    const matchedStoredUser = storedUsers.find((item) => item.id === rawUser.id);

    if (matchedStoredUser && matchedStoredUser.riverParkVerified !== rawUser.riverParkVerified) {
      setUser(toAppUser(matchedStoredUser));
    }
  }, [rawUser, setUser, storedUsers]);

  useEffect(() => {
    if (!rawUser) {
      return;
    }

    const matchedStoredUser = storedUsers.find((item) => item.id === rawUser.id);

    if (!matchedStoredUser || !isUserActive(matchedStoredUser.status)) {
      setUser(null);
    }
  }, [rawUser, setUser, storedUsers]);

  const findStoredUserById = (userId: string) => storedUsers.find((item) => item.id === userId);
  const findStoredUserByIdentifier = (identifier: string) => {
    const normalizedIdentifier = normalizeSignInIdentifier(identifier);

    return storedUsers.find((item) => {
      const normalizedEmail = item.email.trim().toLowerCase();
      const normalizedPhone = normalizePhoneNumber(item.phoneNumber);

      return normalizedEmail === normalizedIdentifier || normalizedPhone === normalizedIdentifier;
    });
  };

  const cacheStoredUser = (nextUser: StoredUser) => {
    setStoredUsers((currentUsers) => {
      const normalizedNextEmail = nextUser.email.trim().toLowerCase();
      const normalizedNextPhone = normalizePhoneNumber(nextUser.phoneNumber);
      const existingUser = currentUsers.find(
        (storedUser) =>
          storedUser.id === nextUser.id ||
          (storedUser.role === nextUser.role &&
            (storedUser.email.trim().toLowerCase() === normalizedNextEmail ||
              Boolean(
                normalizedNextPhone &&
                  normalizePhoneNumber(storedUser.phoneNumber) === normalizedNextPhone,
              ))),
      );
      const userWithCachedPassword: StoredUser = {
        ...nextUser,
        password: nextUser.password || existingUser?.password || '',
      };

      return [
        userWithCachedPassword,
        ...currentUsers.filter((storedUser) => {
          const sameId = storedUser.id === nextUser.id;
          const sameRole = storedUser.role === nextUser.role;
          const sameEmail =
            sameRole && storedUser.email.trim().toLowerCase() === normalizedNextEmail;
          const samePhone = Boolean(
            sameRole &&
              normalizedNextPhone &&
              normalizePhoneNumber(storedUser.phoneNumber) === normalizedNextPhone,
          );

          return !sameId && !sameEmail && !samePhone;
        }),
      ];
    });
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !isSessionHydrated || !supabaseSession) {
      return undefined;
    }

    const needsAppRestore = (supabaseSession.portal ?? 'app') === 'app' && !rawUser;
    const needsAdminRestore = supabaseSession.portal === 'admin' && !rawAdminUser;

    if (!needsAppRestore && !needsAdminRestore) {
      return undefined;
    }

    let isCancelled = false;

    const restoreSession = async () => {
      let currentSession = supabaseSession;
      if (
        currentSession.refreshToken &&
        (currentSession.expiresAt ?? 0) <= Math.floor(Date.now() / 1000) + 60
      ) {
        currentSession = {
          ...(await refreshSupabaseSession(currentSession.refreshToken)),
          portal: currentSession.portal ?? 'app',
        };
        if (!isCancelled) {
          setSupabaseSession(currentSession);
        }
      }

      if (currentSession.portal === 'admin') {
        const restoredAdmin = await fetchMySupabaseAdmin(currentSession.accessToken);
        if (!isCancelled) {
          setAdminUser(restoredAdmin);
        }
        return;
      }

      const result = await syncSupabaseSessionProfile(currentSession.accessToken);
      if (!isCancelled) {
        cacheStoredUser(result.storedUser);
        setUser(result.user);
      }
    };

    restoreSession().catch(() => {
      if (!isCancelled) {
        setSupabaseSession(null);
        setUser(null);
        setAdminUser(null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    isSessionHydrated,
    rawAdminUser,
    rawUser,
    setAdminUser,
    setSupabaseSession,
    setUser,
    supabaseSession,
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured || !isSessionHydrated || !supabaseSession?.refreshToken) {
      return undefined;
    }

    const refreshDelay = Math.max(
      0,
      (supabaseSession.expiresAt ?? 0) * 1000 - Date.now() - 60_000,
    );
    const timer = setTimeout(() => {
      refreshSupabaseSession(supabaseSession.refreshToken as string)
        .then((refreshedSession) => {
          setSupabaseSession({
            ...refreshedSession,
            portal: supabaseSession.portal ?? 'app',
          });
        })
        .catch(() => {
          setSupabaseSession(null);
          setUser(null);
          setAdminUser(null);
        });
    }, refreshDelay);

    return () => clearTimeout(timer);
  }, [
    isSessionHydrated,
    setAdminUser,
    setSupabaseSession,
    setUser,
    supabaseSession,
  ]);

  useEffect(() => {
    const accessToken = supabaseSession?.accessToken;

    if (
      !isSupabaseConfigured ||
      !accessToken ||
      !rawUser ||
      syncedProfileSessionRef.current === accessToken
    ) {
      return;
    }

    syncedProfileSessionRef.current = accessToken;
    syncSupabaseSessionProfile(accessToken)
      .then((result) => {
        cacheStoredUser(result.storedUser);
        setUser(result.user);
      })
      .catch(() => {
        syncedProfileSessionRef.current = null;
      });
  }, [rawUser?.id, supabaseSession?.accessToken]);

  const beginSocialSignIn = (webRedirectPath?: string) => {
    pendingOAuthRedirectPathRef.current = webRedirectPath;
    oauthCallbackHandledRef.current = false;
    oauthCallbackUrlRef.current = null;
  };

  const dismissNativeAuthBrowser = () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      // Android's auth-session polyfill dismisses its Custom Tab through this
      // synchronous bridge. Do not chain `.catch()` because older standalone
      // Android builds correctly return void here.
      WebBrowser.dismissAuthSession();
      return;
    } catch {
      // Fall back for native implementations that only expose dismissBrowser.
    }

    try {
      const dismissal = WebBrowser.dismissBrowser();

      if (dismissal && typeof dismissal.catch === 'function') {
        void dismissal.catch(() => undefined);
      }
    } catch {
      // The browser may already have closed after the deep-link callback.
    }
  };

  const completeSocialSignIn = async (callbackUrl: string | null) => {
    const contextualCallbackUrl = callbackUrl
      ? addOAuthContextToCallbackUrl(
          callbackUrl,
          pendingOAuthRedirectPathRef.current ??
            (Platform.OS === 'web' ? undefined : '/auth/callback?oauthRole=resident'),
        )
      : null;
    const isPasswordRecovery = /(?:[?#&])type=recovery(?:&|$)/i.test(
      contextualCallbackUrl ?? '',
    );

    if (
      !isSupabaseConfigured ||
      !contextualCallbackUrl ||
      !contextualCallbackUrl.includes('access_token=')
    ) {
      return false;
    }

    if (Platform.OS !== 'web') {
      // Close the in-app auth surface immediately. Profile syncing can finish
      // after the customer is already back inside View2Connect.
      dismissNativeAuthBrowser();
    }

    // Android can deliver the callback through Linking and then resolve the
    // WebBrowser auth request with the same URL. Treat that second delivery as
    // a completed login instead of showing a false error.
    if (oauthCallbackHandledRef.current) {
      return oauthCallbackUrlRef.current === contextualCallbackUrl;
    }

    oauthCallbackHandledRef.current = true;
    oauthCallbackUrlRef.current = contextualCallbackUrl;

    try {
      const result = await completeSupabaseOAuth(contextualCallbackUrl);

      if (!result) {
        oauthCallbackHandledRef.current = false;
        return false;
      }

      cacheStoredUser(result.storedUser);
      setSupabaseSession(result.session);
      setUser(result.user);
      setPasswordRecoveryReady(isPasswordRecovery);
      if (!isPasswordRecovery) {
        notifyUserLogin(result.user);
      }
      pendingOAuthRedirectPathRef.current = undefined;

      if (Platform.OS !== 'web') {
        // A deep link opens the app but does not automatically close Android's
        // Chrome Custom Tab. Dismiss it after the session has been persisted.
        dismissNativeAuthBrowser();
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      }

      return true;
    } catch (error) {
      oauthCallbackHandledRef.current = false;
      oauthCallbackUrlRef.current = null;
      throw error;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    const handleCallbackUrl = (url: string | null) => {
      completeSocialSignIn(url).catch((error) => {
        if (error instanceof Error) {
          Alert.alert('Login failed', error.message);
        }
      });
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleCallbackUrl(event.url);
    });

    Linking.getInitialURL()
      .then(handleCallbackUrl)
      .catch(() => undefined);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      handleCallbackUrl(window.location.href);
    }

    return () => {
      subscription.remove();
    };
  }, [setSupabaseSession, setUser]);

  function notifyUserLogin(loggedInUser: AppUser) {
    const roleNotificationCopy =
      loggedInUser.role === 'businessOwner'
        ? {
            title: 'Store owner dashboard opened',
            body: 'Welcome back to your seller portal. Review orders, catalog updates, payouts, and store notifications.',
          }
        : loggedInUser.role === 'dispatch'
          ? {
              title: 'Dispatch dashboard opened',
              body: 'Welcome back to dispatch. Complete KYC if required, then review delivery jobs and rider alerts.',
            }
          : {
              title: 'Customer account opened',
              body: 'Welcome back to View2Connect. You can shop products, food, stores, and customer benefits.',
            };
    const title = securitySettings.loginAnnouncementEnabled
      ? `${authRoleLabel(loggedInUser.role)} notice: ${securitySettings.loginAnnouncementTitle}`
      : roleNotificationCopy.title;
    const body = securitySettings.loginAnnouncementEnabled
      ? securitySettings.loginAnnouncementBody
      : roleNotificationCopy.body;

    appendNotification({
      userId: loggedInUser.id,
      userName: loggedInUser.fullName,
      recipientEmail: loggedInUser.email,
      audience: loggedInUser.role,
      title,
      body,
      contextType: 'general',
      contextId: `login-${loggedInUser.id}-${Date.now()}`,
    });
  }

  const signIn = async (values: SignInFormValues) => {
    if (securitySettings.maintenanceMode) {
      const requestedRole = values.accountRole;
      const roleLabel =
        requestedRole === 'businessOwner'
          ? 'Store owner'
          : requestedRole === 'dispatch'
            ? 'Dispatch'
            : 'Customer';
      throw new Error(
        `${roleLabel} login is temporarily paused while the marketplace is in maintenance mode.`,
      );
    }

    const normalizedIdentifier = normalizeSignInIdentifier(values.identifier);
    const requestedRole = values.accountRole;
    let remoteLoginError: unknown;

    if (isSupabaseConfigured) {
      try {
        const remoteLogin = await signInWithSupabase(
          normalizedIdentifier,
          values.password,
          requestedRole,
        );

        if (!isUserActive(remoteLogin.user.status)) {
          throw new Error('This account is currently suspended or deleted.');
        }

        cacheStoredUser(remoteLogin.storedUser);
        setSupabaseSession(remoteLogin.session);
        setUser(remoteLogin.user);
        notifyUserLogin(remoteLogin.user);
        return;
      } catch (caughtRemoteLoginError) {
        if (storedUsers.length === 0) {
          throw caughtRemoteLoginError instanceof Error
            ? caughtRemoteLoginError
            : new Error('Unable to sign in with Supabase right now.');
        }

        remoteLoginError = caughtRemoteLoginError;
      }
    }

    if (!isUrbanConnectLocalTestMode) {
      if (remoteLoginError) {
        throw remoteLoginError instanceof Error
          ? remoteLoginError
          : new Error('Unable to sign in with Supabase right now.');
      }

      throw new Error('Authentication is not configured. Contact View2Connect support.');
    }

    const matchedUser = storedUsers.find((item) => {
      const normalizedEmail = item.email.trim().toLowerCase();
      const normalizedPhone = normalizePhoneNumber(item.phoneNumber);
      const matchesIdentity =
        normalizedEmail === normalizedIdentifier || normalizedPhone === normalizedIdentifier;

      return (
        matchesIdentity &&
        item.password === values.password &&
        (!requestedRole || item.role === requestedRole)
      );
    });

    if (!matchedUser) {
      if (remoteLoginError && !isRecoverableSupabaseSetupError(remoteLoginError)) {
        throw remoteLoginError instanceof Error
          ? remoteLoginError
          : new Error('Unable to sign in with Supabase right now.');
      }

      if (requestedRole) {
        const existingIdentity = storedUsers.find((item) => {
          const normalizedEmail = item.email.trim().toLowerCase();
          const normalizedPhone = normalizePhoneNumber(item.phoneNumber);

          return normalizedEmail === normalizedIdentifier || normalizedPhone === normalizedIdentifier;
        });

        if (existingIdentity && existingIdentity.role === requestedRole) {
          throw new Error(
            roleConflictMessage(
              existingIdentity.role,
              requestedRole,
              normalizedIdentifier.includes('@') ? 'email' : 'phone number',
            ),
          );
        }

        throw new Error(`No ${authRoleLabel(requestedRole)} account matched those login details.`);
      }

      throw new Error('Incorrect email, phone number, or password.');
    }

    if (!isUserActive(matchedUser.status)) {
      throw new Error('This account is currently suspended by the owner.');
    }

    const nextUser = toAppUser(matchedUser);
    setUser(nextUser);
    notifyUserLogin(nextUser);
  };

  const resetPassword = async (identifier: string, nextPassword: string) => {
    const normalizedPassword = nextPassword.trim();

    if (normalizedPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const matchedUser = findStoredUserByIdentifier(identifier);

    if (matchedUser) {
      setStoredUsers((currentUsers) =>
        currentUsers.map((storedUser) =>
          storedUser.id === matchedUser.id
            ? { ...storedUser, password: normalizedPassword }
            : storedUser,
        ),
      );
      return 'user';
    }

    const normalizedEmail = normalizeAdminEmail(identifier);
    if (!isUrbanConnectLocalTestMode) {
      throw new Error('Password recovery must be completed through the secure reset link.');
    }

    const matchedAdmin = storedAdminUsers.find(
      (admin) => normalizeAdminEmail(admin.email) === normalizedEmail,
    );

    if (matchedAdmin) {
      setStoredAdminUsers((currentAdmins) =>
        currentAdmins.map((admin) =>
          admin.id === matchedAdmin.id ? { ...admin, password: normalizedPassword } : admin,
        ),
      );
      return 'admin';
    }

    throw new Error('No View2Connect account was found for that email or phone number.');
  };

  const changePassword = async (currentPassword: string, nextPassword: string) => {
    if (!user) {
      throw new Error('Sign in before changing your password.');
    }

    const normalizedCurrentPassword = currentPassword.trim();
    const normalizedNextPassword = nextPassword.trim();

    if (normalizedCurrentPassword.length < 6) {
      throw new Error('Enter your current password.');
    }

    if (normalizedNextPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    if (normalizedCurrentPassword === normalizedNextPassword) {
      throw new Error('Choose a new password that is different from the current one.');
    }

    const matchedUser = findStoredUserById(user.id);
    let currentPasswordVerified = false;

    if (isSupabaseConfigured) {
      try {
        const remoteLogin = await signInWithSupabase(user.email, normalizedCurrentPassword);
        const accessToken = remoteLogin.session?.accessToken ?? supabaseSession?.accessToken;

        if (accessToken) {
          await updateSupabaseAuthPassword(accessToken, normalizedNextPassword);
        }

        if (remoteLogin.session) {
          setSupabaseSession(remoteLogin.session);
        }

        currentPasswordVerified = true;
      } catch (remotePasswordError) {
        if (!matchedUser?.password) {
          throw remotePasswordError instanceof Error
            ? remotePasswordError
            : new Error('Current password could not be verified.');
        }
      }
    }

    if (!currentPasswordVerified) {
      if (!matchedUser || matchedUser.password !== normalizedCurrentPassword) {
        throw new Error('Current password is incorrect.');
      }

      currentPasswordVerified = true;
    }

    if (!currentPasswordVerified) {
      throw new Error('Current password could not be verified.');
    }

    setStoredUsers((currentUsers) =>
      currentUsers.map((storedUser) =>
        storedUser.id === user.id ? { ...storedUser, password: normalizedNextPassword } : storedUser,
      ),
    );

    appendNotification({
      userId: user.id,
      userName: user.fullName,
      recipientEmail: user.email,
      audience: user.role,
      title: 'Password changed',
      body: 'Your View2Connect login password was changed from Settings. If this was not you, contact support immediately.',
      contextType: 'general',
      contextId: `password-change-${user.id}-${Date.now()}`,
    });
  };

  const completePasswordRecovery = async (nextPassword: string) => {
    const accessToken = supabaseSession?.accessToken;
    const normalizedPassword = nextPassword.trim();

    if (!passwordRecoveryReady || !accessToken) {
      throw new Error('The password recovery link is missing or has expired.');
    }

    if (normalizedPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }

    await updateSupabaseAuthPassword(accessToken, normalizedPassword);
    await signOutSupabase(accessToken).catch(() => undefined);
    setPasswordRecoveryReady(false);
    setSupabaseSession(null);
    setUser(null);
  };

  const cancelPasswordRecovery = () => {
    const accessToken = supabaseSession?.accessToken;
    if (accessToken) {
      void signOutSupabase(accessToken).catch(() => undefined);
    }
    setPasswordRecoveryReady(false);
    setSupabaseSession(null);
    setUser(null);
  };

  const updateUserSecurityPreference = (patch: Partial<UserSecurityPreference>) => {
    if (!user) {
      return;
    }

    setUserSecurityPreferencesByUser((currentPreferences) => {
      const currentPreference = {
        ...defaultUserSecurityPreference,
        ...(currentPreferences[user.id] ?? {}),
      };

      return {
        ...currentPreferences,
        [user.id]: {
          ...currentPreference,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const signInAdmin = async (values: AdminSignInFormValues) => {
    const normalizedEmail = normalizeAdminEmail(values.email);

    if (isSupabaseConfigured) {
      try {
        const remoteLogin = await verifySupabaseAdmin(normalizedEmail, values.password);
        const remoteAdmin = remoteLogin.admin;

        if (remoteAdmin) {
          if (!remoteAdmin.isActive) {
            throw new Error('This customer care account is currently deactivated by the owner.');
          }

          setUser(null);
          setSupabaseSession(remoteLogin.session);
          setAdminUser(remoteAdmin);
          return;
        }
      } catch (remoteAdminError) {
        if (!isRecoverableSupabaseSetupError(remoteAdminError)) {
          throw remoteAdminError instanceof Error
            ? remoteAdminError
            : new Error('Unable to sign in to admin with Supabase right now.');
        }
      }
    }

    if (!isUrbanConnectLocalTestMode) {
      throw new Error('Admin authentication is unavailable. Contact the View2Connect owner.');
    }

    const matchedAdmin = storedAdminUsers.find(
      (item) => normalizeAdminEmail(item.email) === normalizedEmail && item.password === values.password,
    );

    if (!matchedAdmin) {
      throw new Error('Incorrect admin email or password.');
    }

    if (!matchedAdmin.isActive) {
      throw new Error('This customer care account is currently deactivated by the owner.');
    }

    setAdminUser(toAdminUser(matchedAdmin));
  };

  const assertSignupCanContinue = (values: SignUpFormValues) => {
    if (securitySettings.maintenanceMode) {
      throw new Error('Signup is temporarily paused while the marketplace is in maintenance mode.');
    }

    if (values.role === 'resident' && !securitySettings.allowResidentSignups) {
      throw new Error('Resident signup is currently paused by the owner.');
    }

    if (values.role === 'businessOwner' && !securitySettings.allowBusinessOwnerSignups) {
      throw new Error('Business owner signup is currently paused by the owner.');
    }

    const normalizedEmail = values.email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(values.phoneNumber);
    const existingEmailUser = storedUsers.find(
      (item) => item.email.trim().toLowerCase() === normalizedEmail && item.role === values.role,
    );

    if (existingEmailUser) {
      throw new Error(roleConflictMessage(existingEmailUser.role, values.role, 'email'));
    }

    const existingPhoneUser = storedUsers.find(
      (item) => normalizePhoneNumber(item.phoneNumber) === normalizedPhone && item.role === values.role,
    );

    if (existingPhoneUser) {
      throw new Error(roleConflictMessage(existingPhoneUser.role, values.role, 'phone number'));
    }

    return undefined;
  };

  const requestSignUpVerification = async (values: SignUpFormValues) => {
    assertSignupCanContinue(values);

    if (!isSupabaseConfigured) {
      throw new Error('Email verification is not configured yet. Please contact customer care.');
    }

    try {
      await sendSupabaseSignupVerificationCode(values);
    } catch (error) {
      throw new Error(normalizeSignupVerificationError(error));
    }
  };

  const signUp = async (values: SignUpFormValues, verificationCode: string) => {
    assertSignupCanContinue(values);

    if (isSupabaseConfigured) {
      const remoteSignup = await signUpWithSupabase(values, verificationCode);
      const storedSignupUser: StoredUser = { ...remoteSignup.storedUser, password: '' };

      cacheStoredUser(storedSignupUser);
      setSupabaseSession(remoteSignup.session);
      setUser(remoteSignup.user);
      appendNotification({
        userId: remoteSignup.user.id,
        userName: remoteSignup.user.fullName,
        recipientEmail: remoteSignup.user.email,
        audience: remoteSignup.user.role,
        title: 'Welcome to View2Connect',
        body:
          remoteSignup.user.role === 'businessOwner'
            ? 'Your email is verified and your seller dashboard is ready. Your store application is waiting for admin review.'
            : remoteSignup.user.role === 'dispatch'
              ? 'Your email is verified and your dispatch dashboard is ready.'
            : 'Your customer account has been created. You can now shop products, find services, and contact customer care.',
        contextType: 'general',
        contextId: `signup-${remoteSignup.user.id}`,
        createdAt: new Date().toISOString(),
      });

      if (remoteSignup.user.role === 'businessOwner') {
        notifyBusinessOwnerInspection(remoteSignup.user);
      }

      return;
    }

    throw new Error('Email verification is required before creating an account.');
  };

  const signOut = () => {
    const accessToken = supabaseSession?.accessToken;

    if (isSupabaseConfigured && accessToken) {
      void signOutSupabase(accessToken).catch(() => undefined);
    }

    setSupabaseSession(null);
    setUser(null);
  };

  const deleteCurrentAccount = async () => {
    if (!user) {
      return;
    }

    const targetUser = user;

    if (isSupabaseConfigured) {
      await updateSupabaseUserProfile(targetUser.id, { status: 'suspended' });
    }

    setStoredUsers((currentUsers) =>
      currentUsers.filter((storedUser) => storedUser.id !== targetUser.id),
    );
    setUserSecurityPreferencesByUser((currentPreferences) => {
      const { [targetUser.id]: _deletedPreference, ...remainingPreferences } =
        currentPreferences;

      return remainingPreferences;
    });
    setSupabaseSession(null);
    setUser(null);
  };

  const signOutAdmin = () => {
    const accessToken = supabaseSession?.accessToken;

    if (isSupabaseConfigured && accessToken) {
      void signOutSupabase(accessToken).catch(() => undefined);
    }

    setSupabaseSession(null);
    setAdminUser(null);
  };

  const setAdminAccountActive = (
    adminId: string,
    isActive: boolean,
    actorName = 'View2Connect Owner',
    actorRole: AdminUser['role'] = 'owner',
  ) => {
    if (!canAdminEditSensitiveData(actorRole)) {
      return;
    }

    setStoredAdminUsers((currentAdmins) =>
      currentAdmins.map((admin) =>
        admin.id === adminId && admin.role === 'customerCare'
          ? { ...admin, isActive }
          : admin,
      ),
    );

    const matchedAdmin = storedAdminUsers.find((admin) => admin.id === adminId);

    if (matchedAdmin) {
      appendAuditLog(
        actorName,
        actorRole,
        isActive ? 'Customer care activated' : 'Customer care deactivated',
        `${matchedAdmin.fullName} was marked ${isActive ? 'active' : 'inactive'}.`,
      );
    }
  };

  const createCustomerCareAccount = (
    values: {
      fullName: string;
      email: string;
      password: string;
    },
    actorName = 'View2Connect Owner',
    actorRole: AdminUser['role'] = 'owner',
  ) => {
    if (!canAdminEditSensitiveData(actorRole)) {
      throw new Error('Only the owner can create customer care accounts.');
    }

    const fullName = values.fullName.trim();
    const email = normalizeAdminEmail(values.email);
    const password = values.password.trim();

    if (!fullName) {
      throw new Error('Enter the customer care agent name.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid customer care email.');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (storedAdminUsers.some((admin) => normalizeAdminEmail(admin.email) === email)) {
      throw new Error('A customer care account with that email already exists.');
    }

    const createdAt = new Date().toISOString();
    const nextAdmin: StoredAdminUser = {
      id: `admin-customer-care-${Date.now()}`,
      fullName,
      email,
      password,
      role: 'customerCare',
      isActive: true,
      createdAt,
    };

    setStoredAdminUsers((currentAdmins) => [nextAdmin, ...currentAdmins]);

    appendAuditLog(
      actorName,
      actorRole,
      'Customer care created',
      `${fullName} was added as a customer care agent.`,
    );

    return toAdminUser(nextAdmin);
  };

  const createDispatchAccount = async (
    values: {
      fullName: string;
      email: string;
      phoneNumber: string;
      password: string;
      estateId: string;
      businessCluster?: string;
      adminEmail?: string;
      adminPassword?: string;
    },
    actorName = 'View2Connect Owner',
    actorRole: AdminUser['role'] = 'owner',
  ) => {
    if (!canAdminEditSensitiveData(actorRole)) {
      throw new Error('Only the owner can create dispatch accounts.');
    }

    const fullName = values.fullName.trim();
    const email = values.email.trim().toLowerCase();
    const phoneNumber = values.phoneNumber.trim();
    const password = values.password.trim();
    const estateId = values.estateId.trim() || 'river-park';
    const businessCluster = values.businessCluster?.trim();
    const matchingCluster = riverParkClusters.find((cluster) => cluster === businessCluster);

    if (!fullName) {
      throw new Error('Enter the dispatch rider name.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid dispatch email.');
    }

    if (normalizePhoneNumber(phoneNumber).replace(/\D/g, '').length < 10) {
      throw new Error('Enter a valid dispatch phone number.');
    }

    if (password.length < 6) {
      throw new Error('Dispatch password must be at least 6 characters.');
    }

    const existingEmailUser = storedUsers.find(
      (user) => user.email.trim().toLowerCase() === email && user.role === 'dispatch',
    );

    if (existingEmailUser) {
      throw new Error(roleConflictMessage(existingEmailUser.role, 'dispatch', 'email'));
    }

    const existingPhoneUser = storedUsers.find(
      (user) =>
        normalizePhoneNumber(user.phoneNumber) === normalizePhoneNumber(phoneNumber) &&
        user.role === 'dispatch',
    );

    if (existingPhoneUser) {
      throw new Error(roleConflictMessage(existingPhoneUser.role, 'dispatch', 'phone number'));
    }

    if (isSupabaseConfigured) {
      const remoteDispatch = await createDispatchAccountWithSupabase({
        fullName,
        email,
        phoneNumber,
        password,
        estateId,
        ...(matchingCluster ? { businessCluster: matchingCluster } : {}),
      });
      const storedDispatchUser: StoredUser = {
        ...remoteDispatch.storedUser,
        password,
      };

      cacheStoredUser(storedDispatchUser);
      appendAuditLog(
        actorName,
        actorRole,
        'Dispatch account created',
        `${fullName} was added as a dispatch rider.`,
      );

      return remoteDispatch.user;
    }

    const createdAt = new Date().toISOString();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? 'Dispatch';
    const lastName = nameParts.slice(1).join(' ') || 'Rider';
    const nextDispatchUser: StoredUser = {
      id: `dispatch-${Date.now()}`,
      firstName,
      lastName,
      fullName,
      email,
      phoneNumber,
      password,
      role: 'dispatch',
      estateId,
      riverParkVerified: true,
      status: 'active',
      createdAt,
      ...(matchingCluster ? { businessCluster: matchingCluster } : {}),
    };

    setStoredUsers((currentUsers) => [nextDispatchUser, ...currentUsers]);
    appendAuditLog(
      actorName,
      actorRole,
      'Dispatch account created',
      `${fullName} was added as a dispatch rider.`,
    );
    appendNotification({
      userId: nextDispatchUser.id,
      userName: nextDispatchUser.fullName,
      recipientEmail: nextDispatchUser.email,
      audience: 'dispatch',
      title: 'Dispatch account created',
      body: 'Your View2Connect dispatch account is ready. Use Dispatch Login to access delivery work.',
      contextType: 'general',
      contextId: `dispatch-account-${nextDispatchUser.id}`,
    });

    return toAppUser(nextDispatchUser);
  };

  const updateAdminPassword = (
    adminId: string,
    nextPassword: string,
    actorName = 'View2Connect Owner',
    actorRole: AdminUser['role'] = 'owner',
    actorAdminId?: string,
  ) => {
    const canUpdateTarget =
      canAdminEditSensitiveData(actorRole) || Boolean(actorAdminId && actorAdminId === adminId);

    if (!canUpdateTarget) {
      throw new Error('Only the owner can change other admin passwords.');
    }

    const password = nextPassword.trim();

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const matchedAdmin = storedAdminUsers.find((admin) => admin.id === adminId);

    if (!matchedAdmin) {
      throw new Error('Admin account was not found.');
    }

    setStoredAdminUsers((currentAdmins) =>
      currentAdmins.map((admin) =>
        admin.id === adminId ? { ...admin, password } : admin,
      ),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Admin password changed',
      `${matchedAdmin.fullName} login password was updated.`,
    );
  };

  const setUserStatus = (
    userId: string,
    status: UserStatus,
    actorName = 'View2Connect Owner',
    actorRole: AdminUser['role'] = 'owner',
  ) => {
    if (!canAdminEditSensitiveData(actorRole)) {
      return;
    }

    setStoredUsers((currentUsers) =>
      currentUsers.map((storedUser) =>
        storedUser.id === userId ? { ...storedUser, status } : storedUser,
      ),
    );
    setUserProfileOverrides((currentOverrides) => ({
      ...currentOverrides,
      [userId]: {
        ...currentOverrides[userId],
        status,
        updatedAt: new Date().toISOString(),
      },
    }));

    if (isSupabaseConfigured) {
      void updateSupabaseUserProfile(userId, { status }).catch(() => undefined);
    }

    const matchedUser = storedUsers.find((item) => item.id === userId);

    if (matchedUser) {
      appendAuditLog(
        actorName,
        actorRole,
        status === 'suspended' ? 'User suspended' : 'User restored',
        `${matchedUser.fullName} was marked ${status}.`,
      );
    }
  };

  const setUserRiverParkVerification = (
    userId: string,
    verified: boolean,
    actorName = 'View2Connect Owner',
    actorRole: AdminUser['role'] = 'owner',
  ) => {
    if (!canAdminEditSensitiveData(actorRole)) {
      return;
    }

    setStoredUsers((currentUsers) =>
      currentUsers.map((storedUser) =>
        storedUser.id === userId ? { ...storedUser, riverParkVerified: verified } : storedUser,
      ),
    );
    setUserProfileOverrides((currentOverrides) => ({
      ...currentOverrides,
      [userId]: {
        ...currentOverrides[userId],
        riverParkVerified: verified,
        updatedAt: new Date().toISOString(),
      },
    }));

    setUser((currentUser) =>
      currentUser?.id === userId ? { ...currentUser, riverParkVerified: verified } : currentUser,
    );

    if (isSupabaseConfigured) {
      void setRiverParkVerificationInSupabase(userId, verified).catch(() => undefined);
    }

    const matchedUser = storedUsers.find((item) => item.id === userId);

    if (matchedUser) {
      appendAuditLog(
        actorName,
        actorRole,
        verified ? 'User account verified' : 'User verification revoked',
        `${matchedUser.fullName} was marked ${verified ? 'verified' : 'pending'} for marketplace access.`,
      );

      if (matchedUser.role === 'businessOwner') {
        appendNotification({
          userId: matchedUser.id,
          userName: matchedUser.fullName,
          recipientEmail: matchedUser.email,
          audience: 'businessOwner',
          title: verified ? 'Account verified' : 'Account verification pending',
          body: verified
            ? 'Your seller account has been verified. You can now submit listings for customer care approval.'
            : 'Your seller verification was moved back to pending. Please contact customer care for more information.',
          contextType: 'general',
          contextId: matchedUser.id,
        });
      }
    }
  };

  const findUserById = (userId: string) => {
    const matchedUser = findStoredUserById(userId);
    if (!matchedUser || !isUserActive(matchedUser.status)) {
      return undefined;
    }

    return toAppUser(matchedUser);
  };

  const hasAdminPermission = (permission: AdminPermission) =>
    getAdminPermissions(adminUser?.role).includes(permission);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      users: storedUsers.map(toAppUser),
      ...(supabaseSession?.accessToken
        ? { supabaseAccessToken: supabaseSession.accessToken }
        : {}),
      adminUser,
      adminUsers,
      signIn,
      requestSignUpVerification,
      signUp,
      beginSocialSignIn,
      completeSocialSignIn,
      changePassword,
      deleteCurrentAccount,
      userSecurityPreference,
      updateUserSecurityPreference,
      resetPassword,
      passwordRecoveryReady,
      completePasswordRecovery,
      cancelPasswordRecovery,
      signOut,
      signInAdmin,
      signOutAdmin,
      setAdminAccountActive,
      createCustomerCareAccount,
      createDispatchAccount,
      updateAdminPassword,
      setUserStatus,
      setUserRiverParkVerification,
      findUserById,
      hasAdminPermission,
    }),
    [
      adminUser,
      adminUsers,
      securitySettings,
      passwordRecoveryReady,
      storedUsers,
      supabaseSession?.accessToken,
      user,
      userSecurityPreference,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
