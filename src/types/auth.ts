import type { RiverParkCluster } from './business';

export const userRoles = ['resident', 'businessOwner'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['active', 'suspended'] as const;
export type UserStatus = (typeof userStatuses)[number];

export const adminRoles = ['owner', 'customerCare'] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminPermissions = [
  'exportUsers',
  'exportListings',
  'verifyListings',
  'deleteListings',
] as const;
export type AdminPermission = (typeof adminPermissions)[number];

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  estateId: string;
  businessName?: string;
  businessCluster?: RiverParkCluster;
  riverParkVerified?: boolean;
  status?: UserStatus;
  createdAt: string;
};

export type StoredUser = AppUser & {
  password: string;
};

export type UserSecurityPreference = {
  biometricEnabled: boolean;
  passcodeEnabled: boolean;
  passcode: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
};

export type StoredAdminUser = AdminUser & {
  password: string;
};

export type SignInFormValues = {
  identifier: string;
  password: string;
};

export type AdminSignInFormValues = {
  email: string;
  password: string;
};

export type SignUpFormValues = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  estateId: string;
  businessName: string;
  businessCluster: RiverParkCluster;
};
