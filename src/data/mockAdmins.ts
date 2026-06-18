import type { StoredAdminUser } from '../types/auth';

export const seededAdminUsers: StoredAdminUser[] = [
  {
    id: 'admin-owner',
    fullName: 'UrbanConnect Owner',
    email: 'owner.admin@urbanconnect.com',
    password: 'password123',
    role: 'owner',
    isActive: true,
    createdAt: '2026-05-09T08:00:00.000Z',
  },
  {
    id: 'admin-customer-care',
    fullName: 'UrbanConnect Customer Care',
    email: 'care.admin@urbanconnect.com',
    password: 'password123',
    role: 'customerCare',
    isActive: true,
    createdAt: '2026-05-09T08:15:00.000Z',
  },
];
