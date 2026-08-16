import type { StoredUser } from '../types/auth';
import { readPublicEnv } from '../config/runtime';

const localTestPassword = readPublicEnv('EXPO_PUBLIC_LOCAL_TEST_PASSWORD') ?? '';

export const localTestUsers: StoredUser[] = [
  {
    id: 'local-test-buyer',
    firstName: 'Test',
    lastName: 'Buyer',
    fullName: 'Test Buyer',
    email: 'buyer@test.urbanconnect.local',
    phoneNumber: '+2348000000001',
    role: 'resident',
    estateId: 'river-park',
    riverParkVerified: true,
    status: 'active',
    createdAt: '2026-06-22T00:00:00.000Z',
    password: localTestPassword,
  },
  {
    id: 'local-test-seller',
    firstName: 'Test',
    lastName: 'Seller',
    fullName: 'Test Seller',
    email: 'seller@test.urbanconnect.local',
    phoneNumber: '+2348000000002',
    role: 'businessOwner',
    estateId: 'river-park',
    businessName: 'Local Test Store',
    businessCluster: 'Cluster 1',
    riverParkVerified: true,
    status: 'active',
    createdAt: '2026-06-22T00:00:00.000Z',
    password: localTestPassword,
  },
  {
    id: 'local-test-dispatch',
    firstName: 'Test',
    lastName: 'Dispatch',
    fullName: 'Test Dispatch',
    email: 'dispatch@test.urbanconnect.local',
    phoneNumber: '+2348000000003',
    role: 'dispatch',
    estateId: 'river-park',
    riverParkVerified: true,
    status: 'active',
    createdAt: '2026-06-22T00:00:00.000Z',
    password: localTestPassword,
  },
];
