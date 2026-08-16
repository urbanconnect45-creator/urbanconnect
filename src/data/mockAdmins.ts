import type { StoredAdminUser } from '../types/auth';
import { readPublicEnv } from '../config/runtime';

const localTestPassword = readPublicEnv('EXPO_PUBLIC_LOCAL_TEST_PASSWORD') ?? '';

export const seededAdminUsers: StoredAdminUser[] = [
  {
    id: 'admin-owner',
    fullName: 'View2Connect Owner',
    email: 'owner.admin@urbanconnect.com',
    password: localTestPassword,
    role: 'owner',
    isActive: true,
    createdAt: '2026-05-09T08:00:00.000Z',
  },
  {
    id: 'admin-customer-care',
    fullName: 'View2Connect Customer Care',
    email: 'care.admin@urbanconnect.com',
    password: localTestPassword,
    role: 'customerCare',
    isActive: true,
    createdAt: '2026-05-09T08:15:00.000Z',
  },
];
