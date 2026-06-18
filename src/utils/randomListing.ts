import {
  productCategories,
  professionCategories,
  riverParkClusters,
  type BusinessProfileFormValues,
  type ListingType,
} from '../types/business';
import { supermarketListingTemplates } from '../data/supermarketListings';

type ListingTemplate = {
  name: string;
  category: string;
  shortDescription: string;
  longDescription: string;
  price?: number;
  stockQuantity?: number;
  reorderLevel?: number;
  services: string[];
  images: string[];
};

const supermarketProductTemplates: ListingTemplate[] = supermarketListingTemplates.map((template) => ({
  name: template.name,
  category: template.category,
  shortDescription: template.shortDescription,
  longDescription: template.longDescription,
  price: template.price,
  stockQuantity: template.stockQuantity,
  reorderLevel: template.reorderLevel,
  services: template.services,
  images: template.images,
}));

const productTemplates: ListingTemplate[] = [
  {
    name: 'River Park Fresh Basket',
    category: 'Groceries',
    shortDescription: 'Fresh fruit, snacks, and pantry essentials delivered inside River Park.',
    longDescription:
      'A curated daily basket with fresh produce, drinks, snacks, and home pantry basics. Orders are prepared quickly for River Park residents with clear pickup or delivery coordination through customer care.',
    price: 18500,
    stockQuantity: 24,
    reorderLevel: 6,
    services: ['Fresh stock', 'Same-day estate delivery', 'Family-size pack'],
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Estate Breakfast Box',
    category: 'Food & Drinks',
    shortDescription: 'Ready-to-eat breakfast packs for early River Park mornings.',
    longDescription:
      'A breakfast bundle with pastries, fruit, juice, and light snacks for residents who want quick morning pickup or delivery. Each order is packed fresh and coordinated through customer care.',
    price: 9500,
    stockQuantity: 18,
    reorderLevel: 5,
    services: ['Morning delivery', 'Fresh pastries', 'Family add-ons'],
    images: [
      'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1511690078903-71dc5a49f5e3?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Smart Home Starter Kit',
    category: 'Electronics',
    shortDescription: 'Compact smart plugs, bulbs, and accessories for estate homes.',
    longDescription:
      'A simple electronics kit for residents setting up basic smart home controls. Includes practical accessories, setup guidance, and clear support through customer care if delivery or installation needs coordination.',
    price: 42000,
    stockQuantity: 10,
    reorderLevel: 3,
    services: ['Sealed devices', 'Setup guidance', 'Warranty support'],
    images: [
      'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Glow Care Beauty Pack',
    category: 'Beauty',
    shortDescription: 'Skincare and grooming essentials prepared for River Park buyers.',
    longDescription:
      'A clean beauty pack with everyday skincare, grooming tools, and refill options. Product details are clearly listed so residents can order confidently and customer care can review the package before approval.',
    price: 26500,
    stockQuantity: 16,
    reorderLevel: 4,
    services: ['Sealed products', 'Gift-ready packaging', 'Refill options'],
    images: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'River Park Laundry Bundle',
    category: 'Home Essentials',
    shortDescription: 'Detergent, softener, and cleaning basics for weekly home restock.',
    longDescription:
      'A home essentials bundle built for quick household restocking. Each pack includes laundry and cleaning items that are easy to deliver around the estate and simple for customer care to inspect.',
    price: 21500,
    stockQuantity: 20,
    reorderLevel: 5,
    services: ['Weekly restock', 'Bulk savings', 'Easy delivery'],
    images: [
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1588167056547-c183313da47c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Weekend Snack Crate',
    category: 'Food & Drinks',
    shortDescription: 'Drinks, chips, biscuits, and treats packed for weekend orders.',
    longDescription:
      'A snack crate for families, visitors, and small gatherings inside River Park. Orders are prepared with clear item counts, fresh stock checks, and customer care coordination.',
    price: 14500,
    stockQuantity: 30,
    reorderLevel: 8,
    services: ['Party-ready pack', 'Fresh drinks', 'Fast estate dispatch'],
    images: [
      'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1587560699334-bea93391dcef?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1606914469637-9f7d91c1bfb7?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'School Day Lunch Pack',
    category: 'Food & Drinks',
    shortDescription: 'Neat lunch packs for children and busy residents.',
    longDescription:
      'A convenient lunch pack with balanced meal options, drinks, and snacks. Sellers can use this listing for daily orders, and customer care can coordinate pickup or doorstep delivery.',
    price: 7800,
    stockQuantity: 25,
    reorderLevel: 6,
    services: ['Kid-friendly', 'Daily prep', 'Doorstep delivery'],
    images: [
      'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1566312233526-64f604aee120?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Everyday Style Rack',
    category: 'Fashion',
    shortDescription: 'Casual fashion pieces and accessories for quick estate delivery.',
    longDescription:
      'A small fashion collection with casual clothing, accessories, and seasonal pieces. The listing includes clear photos and item highlights so customer care can review before the seller goes live.',
    price: 33500,
    stockQuantity: 12,
    reorderLevel: 3,
    services: ['Fresh arrivals', 'Size guidance', 'Pickup available'],
    images: [
      'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80',
    ],
  },
];

const serviceTemplates: ListingTemplate[] = [
  {
    name: 'River Park Home Care',
    category: 'Nurse',
    shortDescription: 'Trusted home support and wellness visits for River Park residents.',
    longDescription:
      'A resident-focused service for scheduled home check-ins, wellness support, and practical care coordination. Customer care helps connect residents to the provider and keeps the service request organized.',
    services: ['Home visits', 'Wellness support', 'Fast response'],
    images: [
      'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'SwiftFix Phone Repair',
    category: 'Phone Repair',
    shortDescription: 'Screen, battery, and device checks coordinated inside River Park.',
    longDescription:
      'A practical phone repair service for residents who need quick diagnosis, battery support, screen replacement, or accessory checks. Customer care coordinates the request before the provider responds.',
    services: ['Screen checks', 'Battery support', 'Accessory advice'],
    images: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1580654712603-eb43273aff33?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Estate Electrical Support',
    category: 'Electrician',
    shortDescription: 'Home electrical checks and small repair support for residents.',
    longDescription:
      'A service profile for basic electrical checks, lighting support, fittings, and quick troubleshooting. Residents contact customer care first so jobs can be organized safely.',
    services: ['Light fittings', 'Fault checks', 'Scheduled visits'],
    images: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1586374825514-90e3d1afd3e3?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    name: 'Clean Cut Hair Studio',
    category: 'Hair Stylist',
    shortDescription: 'Neat styling, grooming, and appointment support for estate clients.',
    longDescription:
      'A hair and grooming service for residents who want simple appointment coordination through customer care. The listing describes available styles, response expectations, and client preparation.',
    services: ['Hair styling', 'Grooming', 'Appointment slots'],
    images: [
      'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80',
    ],
  },
];

function pickRandom<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

function uniqueSuffix() {
  return String(Date.now()).slice(-4);
}

function pickTemplate(listingType: ListingType) {
  return listingType === 'product'
    ? pickRandom(supermarketProductTemplates, supermarketProductTemplates[0]!)
    : pickRandom(serviceTemplates, serviceTemplates[0]!);
}

export function createRandomListingForm(
  current: BusinessProfileFormValues,
  listingType: ListingType = current.listingType,
): BusinessProfileFormValues {
  const template = pickTemplate(listingType);
  const images = template.images;
  const coverImage = images[0] ?? current.coverImage;
  const galleryImages = images.slice(1).join(', ');
  const categoryFallback =
    listingType === 'product' ? productCategories[0] : professionCategories[0];

  return {
    ...current,
    listingType,
    businessName:
      listingType === 'product' ? `${template.name} ${uniqueSuffix()}` : template.name,
    cluster: pickRandom(riverParkClusters, current.cluster),
    category:
      template.category ||
      pickRandom(
        listingType === 'product' ? productCategories : professionCategories,
        categoryFallback,
      ),
    shortDescription: template.shortDescription,
    longDescription: template.longDescription,
    price: listingType === 'product' ? String(template.price ?? 15000) : '',
    stockQuantity:
      listingType === 'product' ? String(template.stockQuantity ?? 12) : current.stockQuantity,
    reorderLevel:
      listingType === 'product' ? String(template.reorderLevel ?? 4) : current.reorderLevel,
    coverImage,
    galleryImages,
    galleryVideos: '',
    services: template.services.join(', '),
  };
}
