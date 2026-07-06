import { riverParkClusters, type Estate } from '../types/business';

export const estates: Estate[] = [
  {
    id: 'river-park',
    name: 'View2Connect Marketplace',
    city: 'Nigeria',
    residents: 12680,
    businessesLive: 48,
    averageResponseTime: '12 mins',
    clusters: riverParkClusters,
    amenities: [
      {
        id: 'amenity-clubhouse',
        title: 'Clubhouse and lounge',
        description: 'Resident gatherings, work-friendly seating, and small community events.',
        icon: 'business-outline',
      },
      {
        id: 'amenity-pool',
        title: 'Swimming pool',
        description: 'Family pool access with supervised maintenance windows every week.',
        icon: 'water-outline',
      },
      {
        id: 'amenity-gym',
        title: 'Fitness studio',
        description: 'Cardio, weights, and guided classes from local fitness providers.',
        icon: 'barbell-outline',
      },
      {
        id: 'amenity-parks',
        title: 'Parks and play areas',
        description: 'Open green spaces, children play corners, and shaded walking paths.',
        icon: 'leaf-outline',
      },
      {
        id: 'amenity-security',
        title: 'Gate and patrol security',
        description: 'Cluster gate control, resident verification, and evening patrol coverage.',
        icon: 'shield-checkmark-outline',
      },
    ],
  },
];
