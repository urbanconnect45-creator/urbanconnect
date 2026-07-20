import type { BusinessCategory } from '../types/business';

const categorySignals: Array<{ category: BusinessCategory; keywords: string[] }> = [
  {
    category: 'Baby & Kids',
    keywords: [
      'baby',
      'diaper',
      'feeding bottle',
      'formula',
      'infant',
      'nappy',
      'newborn',
      'toddler',
      'toy',
    ],
  },
  {
    category: 'Health & Pharmacy',
    keywords: [
      'drug',
      'health',
      'medical',
      'medicine',
      'pharmacy',
      'vitamin',
      'wellness',
    ],
  },
  {
    category: 'Drinks',
    keywords: [
      'beverage',
      'coffee',
      'drink',
      'juice',
      'malt',
      'milk',
      'soda',
      'soft drink',
      'tea',
      'water',
    ],
  },
  {
    category: 'Food & Groceries',
    keywords: [
      'baked',
      'bakery',
      'breakfast',
      'burger',
      'cake',
      'cereal',
      'chicken',
      'food',
      'grocery',
      'jollof',
      'meal',
      'noodles',
      'oil',
      'pizza',
      'provision',
      'restaurant',
      'rice',
      'shawarma',
      'spaghetti',
      'stew',
    ],
  },
  {
    category: 'Electronics',
    keywords: [
      'charger',
      'electronic',
      'earbuds',
      'headphone',
      'speaker',
      'television',
    ],
  },
  {
    category: 'Phones & Tablets',
    keywords: [
      'android',
      'iphone',
      'ipad',
      'phone',
      'smartphone',
      'tablet',
    ],
  },
  {
    category: 'Computers & Accessories',
    keywords: [
      'computer',
      'desktop',
      'keyboard',
      'laptop',
      'macbook',
      'monitor',
      'mouse',
      'printer',
    ],
  },
  {
    category: 'Beauty & Personal Care',
    keywords: [
      'beauty',
      'cosmetic',
      'cream',
      'fragrance',
      'hair',
      'lotion',
      'makeup',
      'perfume',
      'skincare',
    ],
  },
  {
    category: 'Fashion',
    keywords: [
      'bag',
      'clothes',
      'dress',
      'fashion',
      'jeans',
      'shoe',
      'shirt',
      'trouser',
      'wear',
    ],
  },
  {
    category: 'Home & Furniture',
    keywords: [
      'bed',
      'chair',
      'furniture',
      'home',
      'mattress',
      'sofa',
      'table',
      'wardrobe',
    ],
  },
  {
    category: 'Home Essentials',
    keywords: [
      'detergent',
      'kitchen',
      'soap',
      'tissue',
      'utensil',
    ],
  },
  {
    category: 'Appliances',
    keywords: [
      'air conditioner',
      'appliance',
      'blender',
      'freezer',
      'fridge',
      'generator',
      'microwave',
      'washing machine',
    ],
  },
  {
    category: 'Vehicles',
    keywords: [
      'bike',
      'car',
      'corolla',
      'motorcycle',
      'suv',
      'toyota',
      'vehicle',
    ],
  },
  {
    category: 'Property',
    keywords: [
      'apartment',
      'flat',
      'house',
      'land',
      'office',
      'property',
      'rent',
      'shop',
    ],
  },
  {
    category: 'Sports & Outdoors',
    keywords: ['fitness', 'football', 'gym', 'outdoor', 'sport'],
  },
  {
    category: 'Books & Stationery',
    keywords: ['book', 'notebook', 'pen', 'school', 'stationery', 'textbook'],
  },
  {
    category: 'Jobs',
    keywords: ['hire', 'job', 'recruit', 'vacancy', 'work'],
  },
  {
    category: 'Pets',
    keywords: ['cat', 'dog', 'pet', 'puppy'],
  },
  {
    category: 'Agriculture',
    keywords: ['farm', 'feed', 'fertilizer', 'seed'],
  },
  {
    category: 'Tools & Equipment',
    keywords: ['drill', 'equipment', 'machine', 'tool'],
  },
];

export function inferListingCategory(...values: string[]) {
  const searchableText = values.join(' ').trim().toLowerCase();

  if (!searchableText) {
    return undefined;
  }

  return categorySignals.find(({ keywords }) =>
    keywords.some((keyword) => searchableText.includes(keyword)),
  )?.category;
}

export function normalizeProductCategory(
  category: BusinessCategory,
  ...listingCopy: string[]
): BusinessCategory {
  const normalizedCategory = category.trim().toLowerCase();

  if (normalizedCategory === 'groceries' || normalizedCategory === 'grocery') {
    return 'Food & Groceries';
  }

  if (normalizedCategory === 'food & drinks' || normalizedCategory === 'food and drinks') {
    return inferListingCategory(...listingCopy) === 'Drinks' ? 'Drinks' : 'Food & Groceries';
  }

  if (normalizedCategory === 'beauty') {
    return 'Beauty & Personal Care';
  }

  if (normalizedCategory === 'real estate' || normalizedCategory === 'realestate') {
    return 'Property';
  }

  if (normalizedCategory === 'cars') {
    return 'Vehicles';
  }

  return category;
}