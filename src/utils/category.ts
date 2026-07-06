import type { BusinessCategory } from '../types/business';

const categorySignals: Array<{ category: BusinessCategory; keywords: string[] }> = [
  {
    category: 'Infant',
    keywords: [
      'baby',
      'diaper',
      'feeding bottle',
      'formula',
      'infant',
      'nappy',
      'newborn',
      'toddler',
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
    category: 'Food',
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
      'computer',
      'earbuds',
      'electronic',
      'headphone',
      'laptop',
      'phone',
      'speaker',
      'television',
    ],
  },
  {
    category: 'Beauty',
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
    category: 'Home Essentials',
    keywords: [
      'appliance',
      'bed',
      'chair',
      'furniture',
      'home',
      'kitchen',
      'mattress',
      'detergent',
      'soap',
      'table',
      'tissue',
      'utensil',
    ],
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
    return 'Food';
  }

  if (normalizedCategory === 'food & drinks' || normalizedCategory === 'food and drinks') {
    return inferListingCategory(...listingCopy) === 'Drinks' ? 'Drinks' : 'Food';
  }

  return category;
}
