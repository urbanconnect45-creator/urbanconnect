import type { BusinessCategory } from '../types/business';

export type SupermarketListingTemplate = {
  slug: string;
  name: string;
  category: BusinessCategory;
  shortDescription: string;
  longDescription: string;
  price: number;
  stockQuantity: number;
  reorderLevel: number;
  services: string[];
  tags: string[];
  images: string[];
};

const riceImage =
  'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80';
const milkImage =
  'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=80';
const noodlesImage =
  'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=900&q=80';
const cookingOilImage =
  'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80';
const drinksImage =
  'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80';
const breadImage =
  'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80';
const eggsImage =
  'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?auto=format&fit=crop&w=900&q=80';
const tomatoImage =
  'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=900&q=80';
const potatoImage =
  'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80';
const fruitImage =
  'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=900&q=80';
const detergentImage =
  'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=900&q=80';
const cleaningImage =
  'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80';
const tissueImage =
  'https://images.unsplash.com/photo-1584727638096-042c45049ebe?auto=format&fit=crop&w=900&q=80';
const babyCareImage =
  'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?auto=format&fit=crop&w=900&q=80';
const toiletriesImage =
  'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=900&q=80';
const antisepticImage =
  'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?auto=format&fit=crop&w=900&q=80';
const lotionImage =
  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=900&q=80';
const beautyImage =
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80';
const pantryImage =
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=900&q=80';
const groceriesImage =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
const produceImage =
  'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80';

export const supermarketListingTemplates: SupermarketListingTemplate[] = [
  {
    slug: 'premium-long-grain-rice-10kg',
    name: 'Premium Long Grain Rice 10kg',
    category: 'Groceries',
    shortDescription: 'A sealed 10kg bag of long grain rice for family meals and bulk restock.',
    longDescription:
      'This rice bag is suitable for jollof rice, fried rice, white rice, and weekly home cooking. It is listed with clear stock counts so River Park residents can order a full pantry restock without guessing quantity.',
    price: 18500,
    stockQuantity: 42,
    reorderLevel: 8,
    services: ['Sealed bag', 'Bulk pantry restock', 'Same-day estate delivery'],
    tags: ['Rice', 'Pantry', 'Family pack'],
    images: [riceImage, pantryImage, groceriesImage],
  },
  {
    slug: 'basmati-rice-5kg',
    name: 'Basmati Rice 5kg',
    category: 'Groceries',
    shortDescription: 'Aromatic basmati rice in a medium 5kg pack for everyday cooking.',
    longDescription:
      'A lighter rice option for residents who want a smaller pack with long, separate grains. Good for fried rice, coconut rice, vegetable rice, and quick weeknight meals.',
    price: 16500,
    stockQuantity: 30,
    reorderLevel: 6,
    services: ['Aromatic grains', 'Medium pack', 'Fast dispatch'],
    tags: ['Rice', 'Basmati', 'Groceries'],
    images: [riceImage, groceriesImage, pantryImage],
  },
  {
    slug: 'full-cream-milk-powder-400g',
    name: 'Full Cream Milk Powder 400g',
    category: 'Food & Drinks',
    shortDescription: 'Creamy powdered milk for tea, cereal, oats, and family breakfast.',
    longDescription:
      'A practical milk powder tin for breakfast tables and pantry backup. Residents can pair it with cereal, beverages, and baking supplies in the same supermarket order.',
    price: 5200,
    stockQuantity: 36,
    reorderLevel: 10,
    services: ['Breakfast staple', 'Sealed tin', 'Shelf-stable'],
    tags: ['Milk', 'Breakfast', 'Pantry'],
    images: [milkImage, pantryImage, groceriesImage],
  },
  {
    slug: 'corn-flakes-cereal-500g',
    name: 'Corn Flakes Cereal 500g',
    category: 'Food & Drinks',
    shortDescription: 'Crunchy breakfast cereal for children, adults, and quick morning meals.',
    longDescription:
      'A family cereal box that works with milk, yogurt, fruit, or snack bowls. The listing is priced as a single 500g pack for easy cart planning.',
    price: 4800,
    stockQuantity: 28,
    reorderLevel: 6,
    services: ['Breakfast ready', 'Family cereal', 'Pairs with milk'],
    tags: ['Cereal', 'Breakfast', 'Kids'],
    images: [pantryImage, milkImage, fruitImage],
  },
  {
    slug: 'chicken-instant-noodles-carton',
    name: 'Chicken Instant Noodles Carton',
    category: 'Food & Drinks',
    shortDescription: 'A full carton of chicken-flavour instant noodles for quick meals.',
    longDescription:
      'A supermarket carton for busy households, students, and quick lunch prep. Each carton is counted as one cart item and is suitable for bulk home restock.',
    price: 7200,
    stockQuantity: 34,
    reorderLevel: 8,
    services: ['Full carton', 'Quick meals', 'Bulk savings'],
    tags: ['Noodles', 'Instant food', 'Carton'],
    images: [noodlesImage, pantryImage, groceriesImage],
  },
  {
    slug: 'vegetable-cooking-oil-5l',
    name: 'Vegetable Cooking Oil 5L',
    category: 'Groceries',
    shortDescription: 'A 5 litre bottle of vegetable cooking oil for frying and everyday meals.',
    longDescription:
      'A household-size cooking oil bottle for frying, stews, sauces, and weekly meal prep. It is listed as a sealed supermarket item with visible stock quantity.',
    price: 12500,
    stockQuantity: 24,
    reorderLevel: 5,
    services: ['Sealed bottle', 'Family-size pack', 'Kitchen staple'],
    tags: ['Cooking oil', 'Kitchen', 'Pantry'],
    images: [cookingOilImage, pantryImage, groceriesImage],
  },
  {
    slug: 'tinned-sardines-pack',
    name: 'Tinned Sardines Pack',
    category: 'Groceries',
    shortDescription: 'A pack of tinned sardines for sandwiches, rice, and emergency meals.',
    longDescription:
      'Shelf-stable tinned fish for quick protein, lunch boxes, sandwiches, rice toppings, and pantry backup. Sold as a supermarket multi-pack.',
    price: 6500,
    stockQuantity: 40,
    reorderLevel: 10,
    services: ['Shelf-stable', 'Protein pack', 'Easy lunch add-on'],
    tags: ['Sardines', 'Tinned food', 'Protein'],
    images: [pantryImage, groceriesImage, produceImage],
  },
  {
    slug: 'bottled-water-12-pack',
    name: 'Bottled Water 12 Pack',
    category: 'Food & Drinks',
    shortDescription: 'Twelve 50cl bottled waters for home, visitors, school, and work.',
    longDescription:
      'A ready-to-carry water pack for daily hydration, gatherings, school bags, and office use. Customer care can coordinate doorstep delivery inside River Park.',
    price: 3000,
    stockQuantity: 60,
    reorderLevel: 15,
    services: ['12 bottles', 'Cold-room option', 'Bulk delivery'],
    tags: ['Water', 'Drinks', 'Hydration'],
    images: [drinksImage, groceriesImage, pantryImage],
  },
  {
    slug: 'cola-soft-drink-12-pack',
    name: 'Cola Soft Drink 12 Pack',
    category: 'Food & Drinks',
    shortDescription: 'A dozen cola drinks for guests, parties, lunch, and weekend restock.',
    longDescription:
      'A supermarket soft drink pack suitable for family meals, small gatherings, and office refreshment. Listed by pack to make stock and delivery easier.',
    price: 5400,
    stockQuantity: 48,
    reorderLevel: 12,
    services: ['12 drinks', 'Party-ready', 'Chilled on request'],
    tags: ['Soft drink', 'Cola', 'Party'],
    images: [drinksImage, groceriesImage, produceImage],
  },
  {
    slug: 'fresh-bakery-bread-loaf',
    name: 'Fresh Bakery Bread Loaf',
    category: 'Food & Drinks',
    shortDescription: 'Soft sliced bread loaf for breakfast, sandwiches, and tea time.',
    longDescription:
      'A fresh bread loaf for morning tables, school lunch, sandwiches, toast, and quick snacks. Best ordered for same-day pickup or delivery.',
    price: 1800,
    stockQuantity: 32,
    reorderLevel: 8,
    services: ['Fresh bakery stock', 'Same-day delivery', 'Breakfast ready'],
    tags: ['Bread', 'Bakery', 'Breakfast'],
    images: [breadImage, milkImage, fruitImage],
  },
  {
    slug: 'fresh-eggs-crate-30-pieces',
    name: 'Fresh Eggs Crate 30 Pieces',
    category: 'Groceries',
    shortDescription: 'A full 30-piece crate of eggs for breakfast, baking, and family cooking.',
    longDescription:
      'Fresh eggs packed in a crate for families, bakers, and weekly cooking. The seller keeps reorder levels visible so buyers can see when stock is running low.',
    price: 6800,
    stockQuantity: 26,
    reorderLevel: 6,
    services: ['30 pieces', 'Careful handling', 'Baking friendly'],
    tags: ['Eggs', 'Breakfast', 'Protein'],
    images: [eggsImage, breadImage, milkImage],
  },
  {
    slug: 'fresh-tomato-basket',
    name: 'Fresh Tomato Basket',
    category: 'Groceries',
    shortDescription: 'A basket of fresh tomatoes for stew, salad, sauces, and soups.',
    longDescription:
      'Fresh tomatoes selected for daily home cooking. Suitable for stew bases, pepper mix, salads, soups, and family-size meal prep.',
    price: 4500,
    stockQuantity: 38,
    reorderLevel: 10,
    services: ['Fresh produce', 'Stew-ready', 'Same-day stock'],
    tags: ['Tomatoes', 'Produce', 'Vegetables'],
    images: [tomatoImage, groceriesImage, produceImage],
  },
  {
    slug: 'irish-potatoes-5kg',
    name: 'Irish Potatoes 5kg',
    category: 'Groceries',
    shortDescription: 'A 5kg produce pack of potatoes for chips, porridge, and side dishes.',
    longDescription:
      'Washed Irish potatoes packed for home cooking, fries, potato porridge, mash, and vegetable sides. A practical produce item for weekly supermarket restock.',
    price: 6200,
    stockQuantity: 27,
    reorderLevel: 7,
    services: ['5kg produce pack', 'Family meals', 'Fresh stock'],
    tags: ['Potatoes', 'Produce', 'Vegetables'],
    images: [potatoImage, groceriesImage, tomatoImage],
  },
  {
    slug: 'apple-and-banana-fruit-pack',
    name: 'Apple And Banana Fruit Pack',
    category: 'Groceries',
    shortDescription: 'A mixed fruit pack for lunch boxes, snacks, smoothies, and breakfast.',
    longDescription:
      'A convenient fruit pack with apples and bananas for residents who want fresh snacks without buying a full carton. Great for children, visitors, and breakfast tables.',
    price: 5200,
    stockQuantity: 35,
    reorderLevel: 8,
    services: ['Fresh fruit', 'Lunch-box friendly', 'Smoothie ready'],
    tags: ['Fruit', 'Apples', 'Bananas'],
    images: [fruitImage, produceImage, groceriesImage],
  },
  {
    slug: 'powder-laundry-detergent-2kg',
    name: 'Powder Laundry Detergent 2kg',
    category: 'Home Essentials',
    shortDescription: 'A 2kg detergent pack for washing clothes, linens, and uniforms.',
    longDescription:
      'A home laundry essential for family wash days, uniforms, towels, and bed linen. Listed as a sealed pack with clear reorder quantity for household restock.',
    price: 4900,
    stockQuantity: 44,
    reorderLevel: 9,
    services: ['Laundry restock', 'Sealed pack', 'Family wash day'],
    tags: ['Detergent', 'Laundry', 'Home care'],
    images: [detergentImage, cleaningImage, toiletriesImage],
  },
  {
    slug: 'antiseptic-liquid-500ml',
    name: 'Antiseptic Liquid 500ml',
    category: 'Home Essentials',
    shortDescription: 'A household antiseptic liquid for hygiene, cleaning, and first-aid support.',
    longDescription:
      'A 500ml antiseptic liquid for bathroom hygiene, laundry soaking, floor cleaning, and basic first-aid support. A useful supermarket item for family care shelves.',
    price: 3600,
    stockQuantity: 31,
    reorderLevel: 7,
    services: ['Hygiene care', 'Sealed bottle', 'Home first-aid shelf'],
    tags: ['Antiseptic', 'Hygiene', 'Home care'],
    images: [antisepticImage, cleaningImage, toiletriesImage],
  },
  {
    slug: 'dishwashing-liquid-750ml',
    name: 'Dishwashing Liquid 750ml',
    category: 'Home Essentials',
    shortDescription: 'Dish soap for plates, pots, pans, bottles, and everyday kitchen cleanup.',
    longDescription:
      'A kitchen cleaning liquid for grease, plates, pots, pans, and lunch containers. A simple supermarket restock item for every home kitchen.',
    price: 1900,
    stockQuantity: 46,
    reorderLevel: 12,
    services: ['Kitchen cleaning', 'Grease control', 'Sealed bottle'],
    tags: ['Dish soap', 'Kitchen', 'Cleaning'],
    images: [cleaningImage, detergentImage, toiletriesImage],
  },
  {
    slug: 'toilet-tissue-12-roll-pack',
    name: 'Toilet Tissue 12 Roll Pack',
    category: 'Home Essentials',
    shortDescription: 'A 12-roll tissue pack for bathrooms, guest rooms, and weekly restock.',
    longDescription:
      'Soft household tissue sold as a bulk 12-roll pack. Good for families, visitors, guest bathrooms, and predictable weekly home restock.',
    price: 4200,
    stockQuantity: 39,
    reorderLevel: 8,
    services: ['12 rolls', 'Bulk home restock', 'Easy delivery'],
    tags: ['Tissue', 'Bathroom', 'Home essentials'],
    images: [tissueImage, toiletriesImage, cleaningImage],
  },
  {
    slug: 'fluoride-toothpaste-3-pack',
    name: 'Fluoride Toothpaste 3 Pack',
    category: 'Beauty',
    shortDescription: 'Three toothpaste tubes for daily brushing and family bathroom restock.',
    longDescription:
      'A family toothpaste pack for morning and night brushing. Practical for residents who want to restock personal care items with groceries.',
    price: 3200,
    stockQuantity: 33,
    reorderLevel: 8,
    services: ['3 tubes', 'Family bathroom stock', 'Personal care'],
    tags: ['Toothpaste', 'Oral care', 'Beauty'],
    images: [toiletriesImage, beautyImage, lotionImage],
  },
  {
    slug: 'body-lotion-400ml',
    name: 'Body Lotion 400ml',
    category: 'Beauty',
    shortDescription: 'A moisturizing body lotion bottle for daily skincare and family use.',
    longDescription:
      'A 400ml lotion for everyday skin care after bathing, hand washing, or outdoor activity. Listed in Beauty so residents can find personal care restocks quickly.',
    price: 5800,
    stockQuantity: 25,
    reorderLevel: 6,
    services: ['Daily skincare', 'Sealed bottle', 'Bathroom restock'],
    tags: ['Lotion', 'Skincare', 'Beauty'],
    images: [lotionImage, beautyImage, toiletriesImage],
  },
  {
    slug: 'baby-diapers-jumbo-pack',
    name: 'Baby Diapers Jumbo Pack',
    category: 'Home Essentials',
    shortDescription: 'A jumbo diaper pack for babies and toddlers with estate delivery.',
    longDescription:
      'A practical baby-care supermarket item for parents who need quick restock. The listing is set up for bulk delivery and clear stock visibility.',
    price: 12800,
    stockQuantity: 22,
    reorderLevel: 5,
    services: ['Jumbo pack', 'Baby care', 'Doorstep delivery'],
    tags: ['Diapers', 'Baby care', 'Family'],
    images: [babyCareImage, toiletriesImage, groceriesImage],
  },
  {
    slug: 'wheat-meal-2kg',
    name: 'Wheat Meal 2kg',
    category: 'Groceries',
    shortDescription: 'A 2kg wheat meal pack for swallow, soups, and family dinner.',
    longDescription:
      'A pantry pack for residents preparing swallow with vegetable soup, egusi, okra, or stew. It is listed as a sealed dry-goods item for easy weekly restock.',
    price: 3900,
    stockQuantity: 29,
    reorderLevel: 6,
    services: ['Dry goods', 'Dinner staple', 'Sealed pack'],
    tags: ['Wheat meal', 'Pantry', 'Groceries'],
    images: [pantryImage, riceImage, groceriesImage],
  },
  {
    slug: 'bathing-soap-6-pack',
    name: 'Bathing Soap 6 Pack',
    category: 'Beauty',
    shortDescription: 'Six bathing soap bars for family bathrooms and guest restock.',
    longDescription:
      'A personal-care soap pack for daily bathing, guest bathrooms, and predictable family restock. The pack is listed under Beauty so it appears with other care items.',
    price: 2900,
    stockQuantity: 37,
    reorderLevel: 9,
    services: ['6 bars', 'Bathroom restock', 'Family pack'],
    tags: ['Soap', 'Bathing', 'Beauty'],
    images: [toiletriesImage, beautyImage, lotionImage],
  },
  {
    slug: 'all-purpose-cleaner-1l',
    name: 'All Purpose Cleaner 1L',
    category: 'Home Essentials',
    shortDescription: 'A 1 litre cleaner for floors, tiles, kitchen counters, and bathrooms.',
    longDescription:
      'A daily home-cleaning bottle for mopping, counter wipe-downs, bathroom surfaces, and small spills. It pairs well with detergent and tissue restock orders.',
    price: 2500,
    stockQuantity: 41,
    reorderLevel: 10,
    services: ['1 litre bottle', 'Home cleaning', 'Kitchen and bathroom'],
    tags: ['Cleaner', 'Home care', 'Cleaning'],
    images: [cleaningImage, detergentImage, tissueImage],
  },
];
