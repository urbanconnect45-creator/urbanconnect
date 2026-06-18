import { estates } from '../data/estates';
import type { SignUpFormValues, UserRole } from '../types/auth';
import { riverParkClusters } from '../types/business';

export const RANDOM_SIGNUP_PASSWORD = 'password123';

const firstNames = [
  'Amina',
  'Caleb',
  'Dara',
  'Emeka',
  'Ife',
  'Kemi',
  'Maya',
  'Noah',
  'Sade',
  'Tomi',
];

const lastNames = [
  'Adeyemi',
  'Cole',
  'Eze',
  'Johnson',
  'Lawal',
  'Morgan',
  'Okafor',
  'Stone',
  'Taylor',
  'Williams',
];

const businessPrefixes = [
  'Freshline',
  'SwiftFix',
  'PrimeCare',
  'DailyMart',
  'BrightHome',
  'GreenBasket',
  'QuickServe',
  'UrbanCraft',
];

const businessSuffixes = [
  'Foods',
  'Repairs',
  'Services',
  'Stores',
  'Wellness',
  'Logistics',
  'Essentials',
  'Studios',
];

function pickRandom<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

function uniqueSeed() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function randomPhoneNumber(seed: string) {
  return `+23480${seed.slice(-8).padStart(8, '0')}`;
}

export function createRandomSignupForm(role: UserRole): SignUpFormValues {
  const firstName = pickRandom(firstNames, 'Maya');
  const lastName = pickRandom(lastNames, 'Johnson');
  const seed = uniqueSeed();
  const emailRole = role === 'businessOwner' ? 'business' : 'resident';
  const businessName =
    role === 'businessOwner'
      ? `${pickRandom(businessPrefixes, 'SwiftFix')} ${pickRandom(businessSuffixes, 'Services')}`
      : '';

  return {
    firstName,
    lastName,
    phoneNumber: randomPhoneNumber(seed),
    email: `${emailRole}.${firstName}.${lastName}.${seed.slice(-6)}@urbanconnect.test`.toLowerCase(),
    password: RANDOM_SIGNUP_PASSWORD,
    confirmPassword: RANDOM_SIGNUP_PASSWORD,
    role,
    estateId: estates[0]?.id ?? 'river-park',
    businessName,
    businessCluster: pickRandom(riverParkClusters, 'Cluster 1'),
  };
}
