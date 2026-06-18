import type {
  AutomatedEmailLog,
  AuditLog,
  Order,
  PaymentPlan,
  SecuritySettings,
} from '../types/business';

export const seededOrders: Order[] = [];

export const defaultSecuritySettings: SecuritySettings = {
  allowResidentSignups: true,
  allowBusinessOwnerSignups: true,
  maintenanceMode: false,
  blockCheckout: false,
  requireManualListingApproval: true,
  sessionTimeoutMinutes: 30,
  maxLoginAttempts: 5,
  loginAnnouncementEnabled: true,
  loginAnnouncementTitle: 'Welcome to UrbanConnect',
  loginAnnouncementBody:
    'River Park marketplace updates, verification notices, and customer care messages will appear in your notifications.',
  subscriptionExemptAccountEmail: 'owner.admin@urbanconnect.com',
};

export const defaultPaymentPlans: PaymentPlan[] = [
  {
    cycle: 'weekly',
    title: 'Weekly plan',
    amount: 4000,
    description: 'Best for short promo bursts and small test listings.',
    updatedAt: '2026-05-19T08:00:00.000Z',
  },
  {
    cycle: 'monthly',
    title: 'Monthly plan',
    amount: 15000,
    description: 'Best for active sellers who want steady marketplace visibility.',
    updatedAt: '2026-05-19T08:00:00.000Z',
  },
];

export const seededEmailLogs: AutomatedEmailLog[] = [];

export const seededAuditLogs: AuditLog[] = [];
