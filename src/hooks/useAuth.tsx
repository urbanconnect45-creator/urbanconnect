import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { Linking } from 'react-native';

import { seededAdminUsers } from '../data/mockAdmins';
import { seededUsers } from '../data/mockUsers';
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
import { canAdminEditSensitiveData, isUserActive } from '../utils/businessState';
import { RANDOM_SIGNUP_PASSWORD } from '../utils/randomSignup';
import { usePersistentState } from './usePersistentState';
import {
  completeSupabaseOAuth,
  fetchSupabaseUserProfiles,
  isRecoverableSupabaseSetupError,
  isSupabaseConfigured,
  setRiverParkVerificationInSupabase,
  sendSupabaseSignupVerificationCode,
  signInWithSupabase,
  signUpWithSupabase,
  updateSupabaseAuthPassword,
  updateSupabaseUserProfile,
  type SupabaseSession,
  verifySupabaseAdmin,
} from '../services/supabaseApi';

type AuthContextValue = {
  user: AppUser | null;
  users: AppUser[];
  demoAccounts: AppUser[];
  adminUser: AdminUser | null;
  adminUsers: AdminUser[];
  adminDemoAccounts: AdminUser[];
  signIn: (values: SignInFormValues) => Promise<void>;
  requestSignUpVerification: (values: SignUpFormValues) => Promise<void>;
  signUp: (values: SignUpFormValues, verificationCode: string) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
  userSecurityPreference: UserSecurityPreference;
  updateUserSecurityPreference: (patch: Partial<UserSecurityPreference>) => void;
  resetPassword: (identifier: string, nextPassword: string) => Promise<'user' | 'admin'>;
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
    riverParkVerified: user.riverParkVerified ?? (user.role === 'resident'),
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

function getAdminPermissions(role: AdminUser['role'] | undefined) {
  if (role === 'owner') {
    return ownerPermissions;
  }

  if (role === 'customerCare') {
    return customerCarePermissions;
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
    seededUsers,
  );
  const [storedAdminUsers, setStoredAdminUsers] = usePersistentState<StoredAdminUser[]>(
    'urbanconnect.adminUsers.v1',
    seededAdminUsers,
  );
  const [rawUser, setUser] = usePersistentState<AppUser | null>('urbanconnect.currentUser.v2', null);
  const [rawAdminUser, setAdminUser] = usePersistentState<AdminUser | null>(
    'urbanconnect.currentAdmin.v1',
    null,
  );
  const [supabaseSession, setSupabaseSession] = usePersistentState<SupabaseSession | null>(
    'urbanconnect.supabaseSession.v1',
    null,
  );
  const [userProfileOverrides, setUserProfileOverrides] = usePersistentState<
    Record<string, UserProfileOverride>
  >('urbanconnect.userProfileOverrides.v1', {});
  const [userSecurityPreferencesByUser, setUserSecurityPreferencesByUser] = usePersistentState<
    Record<string, UserSecurityPreference>
  >('urbanconnect.userSecurityPreferences.v1', {});
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

    if (!matchedAdmin || !matchedAdmin.isActive) {
      return null;
    }

    return toAdminUser(matchedAdmin);
  }, [rawAdminUser, storedAdminUsers]);

  useEffect(() => {
    if (rawAdminUser && !adminUser) {
      setAdminUser(null);
    }
  }, [adminUser, rawAdminUser, setAdminUser]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
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
    const refreshInterval = setInterval(loadProfiles, 1000);

    return () => {
      isCancelled = true;
      clearInterval(refreshInterval);
    };
  }, [setStoredUsers, userProfileOverrides]);

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
      const existingUser = currentUsers.find((storedUser) => storedUser.id === nextUser.id);
      const userWithCachedPassword: StoredUser = {
        ...nextUser,
        password: nextUser.password || existingUser?.password || '',
      };

      return [
        userWithCachedPassword,
        ...currentUsers.filter((storedUser) => storedUser.id !== nextUser.id),
      ];
    });
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    const handleCallbackUrl = (url: string | null) => {
      if (!url || !url.includes('access_token=')) {
        return;
      }

      completeSupabaseOAuth(url)
        .then((result) => {
          if (!result) {
            return;
          }

          cacheStoredUser(result.storedUser);
          setSupabaseSession(result.session);
          setUser(result.user);
          notifyUserLogin(result.user);
        })
        .catch(() => {
          // Provider setup errors are surfaced by the OAuth page itself.
        });
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleCallbackUrl(event.url);
    });

    Linking.getInitialURL()
      .then(handleCallbackUrl)
      .catch(() => undefined);

    return () => {
      subscription.remove();
    };
  }, [setSupabaseSession, setUser]);

  const notifyUserLogin = (loggedInUser: AppUser) => {
    const title = securitySettings.loginAnnouncementEnabled
      ? securitySettings.loginAnnouncementTitle
      : 'Welcome back to UrbanConnect';
    const body = securitySettings.loginAnnouncementEnabled
      ? securitySettings.loginAnnouncementBody
      : 'Welcome back to UrbanConnect. You can shop products, find services, and contact customer care inside River Park.';

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
  };

  const signIn = async (values: SignInFormValues) => {
    if (securitySettings.maintenanceMode) {
      throw new Error('Customer login is temporarily paused while the marketplace is in maintenance mode.');
    }

    const normalizedIdentifier = normalizeSignInIdentifier(values.identifier);
    let remoteLoginError: unknown;

    if (isSupabaseConfigured) {
      try {
        const remoteLogin = await signInWithSupabase(normalizedIdentifier, values.password);

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

    const matchedUser = storedUsers.find((item) => {
      const normalizedEmail = item.email.trim().toLowerCase();
      const normalizedPhone = normalizePhoneNumber(item.phoneNumber);
      const matchesIdentity =
        normalizedEmail === normalizedIdentifier || normalizedPhone === normalizedIdentifier;

      return matchesIdentity && item.password === values.password;
    });

    if (!matchedUser) {
      if (remoteLoginError && !isRecoverableSupabaseSetupError(remoteLoginError)) {
        throw remoteLoginError instanceof Error
          ? remoteLoginError
          : new Error('Unable to sign in with Supabase right now.');
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

    throw new Error('No UrbanConnect account was found for that email or phone number.');
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
      body: 'Your UrbanConnect login password was changed from Settings. If this was not you, contact customer care immediately.',
      contextType: 'general',
      contextId: `password-change-${user.id}-${Date.now()}`,
    });
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
        const remoteAdmin = await verifySupabaseAdmin(normalizedEmail, values.password);

        if (remoteAdmin) {
          if (!remoteAdmin.isActive) {
            throw new Error('This customer care account is currently deactivated by the owner.');
          }

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

    const matchedAdmin = storedAdminUsers.find(
      (item) => normalizeAdminEmail(item.email) === normalizedEmail && item.password === values.password,
    );

    if (!matchedAdmin) {
      throw new Error('Incorrect admin email or password. Try one of the admin demo accounts below.');
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

    if (storedUsers.some((item) => item.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with that email already exists. Please log in instead.');
    }

    if (storedUsers.some((item) => normalizePhoneNumber(item.phoneNumber) === normalizedPhone)) {
      throw new Error('An account with that phone number already exists. Please log in instead.');
    }

    return undefined;
  };

  const requestSignUpVerification = async (values: SignUpFormValues) => {
    assertSignupCanContinue(values);

    if (!isSupabaseConfigured) {
      throw new Error('Email verification is not configured yet. Please contact customer care.');
    }

    await sendSupabaseSignupVerificationCode(values);
  };

  const signUp = async (values: SignUpFormValues, verificationCode: string) => {
    assertSignupCanContinue(values);

    if (isSupabaseConfigured) {
      const remoteSignup = await signUpWithSupabase(values, verificationCode);
      const storedSignupUser: StoredUser = {
        ...remoteSignup.storedUser,
        password:
          values.password === RANDOM_SIGNUP_PASSWORD
            ? RANDOM_SIGNUP_PASSWORD
            : remoteSignup.storedUser.password,
      };

      cacheStoredUser(storedSignupUser);
      setSupabaseSession(remoteSignup.session);
      setUser(remoteSignup.user);
      appendNotification({
        userId: remoteSignup.user.id,
        userName: remoteSignup.user.fullName,
        recipientEmail: remoteSignup.user.email,
        audience: remoteSignup.user.role,
        title: 'Welcome to UrbanConnect',
        body:
          remoteSignup.user.role === 'businessOwner'
            ? 'Your business owner account has been created. Check your notifications for River Park verification and listing next steps.'
            : 'Your resident account has been created. You can now shop River Park products, find services, and contact customer care.',
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
    setAdminUser(null);
  };

  const setAdminAccountActive = (
    adminId: string,
    isActive: boolean,
    actorName = 'UrbanConnect Owner',
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
    actorName = 'UrbanConnect Owner',
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

  const updateAdminPassword = (
    adminId: string,
    nextPassword: string,
    actorName = 'UrbanConnect Owner',
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
    actorName = 'UrbanConnect Owner',
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
    actorName = 'UrbanConnect Owner',
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
        verified ? 'User River Park verified' : 'User River Park verification revoked',
        `${matchedUser.fullName} was marked ${verified ? 'verified' : 'pending'} for River Park residency.`,
      );

      if (matchedUser.role === 'businessOwner') {
        appendNotification({
          userId: matchedUser.id,
          userName: matchedUser.fullName,
          recipientEmail: matchedUser.email,
          audience: 'businessOwner',
          title: verified ? 'Account verified' : 'Account verification pending',
          body: verified
            ? 'Your River Park account has been verified. You can now submit listings for customer care approval.'
            : 'Your River Park verification was moved back to pending. Please contact customer care for more information.',
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
      demoAccounts: storedUsers
        .filter((storedUser) => storedUser.password === RANDOM_SIGNUP_PASSWORD)
        .slice(0, 6)
        .map(toAppUser),
      adminUser,
      adminUsers,
      adminDemoAccounts: adminUsers,
      signIn,
      requestSignUpVerification,
      signUp,
      changePassword,
      deleteCurrentAccount,
      userSecurityPreference,
      updateUserSecurityPreference,
      resetPassword,
      signOut,
      signInAdmin,
      signOutAdmin,
      setAdminAccountActive,
      createCustomerCareAccount,
      updateAdminPassword,
      setUserStatus,
      setUserRiverParkVerification,
      findUserById,
      hasAdminPermission,
    }),
    [adminUser, adminUsers, securitySettings, storedUsers, user, userSecurityPreference],
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
