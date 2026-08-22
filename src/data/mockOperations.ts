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
  loginAnnouncementTitle: 'Welcome to View2Connect',
  loginAnnouncementBody:
    'Marketplace updates, verification notices, and customer care messages will appear in your notifications.',
  subscriptionExemptAccountEmail: 'owner.admin@urbanconnect.com',
  minimumWithdrawalAmount: 1000,
  maximumWithdrawalAmount: 1000000,
  vatTierOneAmount: 500,
  vatTierTwoBaseAmount: 1500,
  vatAdditionalBandAmount: 1000,
  packingTierOneAmount: 50,
  packingTierTwoAmount: 100,
  packingTierThreeAmount: 200,
  packingTierFourAmount: 300,
  packingTierFiveAmount: 500,
  packingTierSixAmount: 800,
};

export const defaultPaymentPlans: PaymentPlan[] = [
  {
    cycle: 'weekly',
    title: 'Weekly plan',
    amount: 4000,
    description: 'Best for short promotions and growing marketplace visibility.',
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
