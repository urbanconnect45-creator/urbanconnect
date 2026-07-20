import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ProductCard } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { getBusinessPriorityScore, isPublicBusiness } from '../utils/businessState';
import { normalizeProductCategory } from '../utils/category';

const foodFilters = [
  { id: 'all', label: 'All food', icon: 'restaurant-outline', terms: [] },
  { id: 'restaurants', label: 'Restaurants', icon: 'storefront-outline', terms: ['restaurant', 'meal', 'kitchen'] },
  { id: 'fast-food', label: 'Fast food', icon: 'fast-food-outline', terms: ['fast food', 'snack', 'burger', 'pizza'] },
  { id: 'bakeries', label: 'Bakeries', icon: 'nutrition-outline', terms: ['bakery', 'bread', 'cake', 'pastry'] },
] as const;

type FoodFilterId = (typeof foodFilters)[number]['id'];

export function FoodScreen({ navigation }: MainTabsScreenProps<'Food'>) {
  const { user } = useAuth();
  const {
    businesses,
    addToCart,
    cartEntries,
    getAvailableStock,
    isBusinessOwnedByUser,
    isStoreOwnerListing,
    updateCartQuantity,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const [selectedFilter, setSelectedFilter] = useState<FoodFilterId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = width < 780;
  const columnCount = width >= 1280 ? 3 : 2;

  const foodListings = useMemo(
    () =>
      businesses
        .filter(
          (business) =>
            business.listingType === 'product' &&
            isPublicBusiness(business) &&
            isStoreOwnerListing(business),
        )
        .map((business) => ({
          ...business,
          category: normalizeProductCategory(
            business.category,
            business.name,
            business.description,
            business.longDescription,
          ),
        }))
        .filter((business) => business.category === 'Food')
        .sort(
          (leftBusiness, rightBusiness) =>
            getBusinessPriorityScore(rightBusiness) - getBusinessPriorityScore(leftBusiness),
        ),
    [businesses, isStoreOwnerListing],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const activeFilter = foodFilters.find((filter) => filter.id === selectedFilter) ?? foodFilters[0];
  const filteredListings = foodListings.filter((business) => {
    const searchable = [
      business.name,
      business.category,
      business.description,
      business.address,
      ...business.tags,
    ]
      .join(' ')
      .toLowerCase();
    const matchesFilter =
      activeFilter.terms.length === 0 ||
      activeFilter.terms.some((term) => searchable.includes(term));

    return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  return (
    <View style={styles.screen}>
      <FlatList
        key={`food-${columnCount}`}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons color={colors.primary} name="restaurant-outline" size={32} />
            <Text style={styles.emptyTitle}>No food items match this search yet.</Text>
            <Text style={styles.emptyText}>
              Approved restaurants, meals, snacks, and bakery items will appear here.
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>View2Connect Food</Text>
                <Text style={styles.title}>Food from sellers near you.</Text>
                <Text style={styles.subtitle}>
                  Browse ready meals, restaurant dishes, snacks, and bakery items in one place.
                </Text>
              </View>
              <View style={styles.heroIcon}>
                <Ionicons color={colors.white} name="fast-food-outline" size={42} />
              </View>
            </View>

            <View style={styles.searchShell}>
              <Ionicons color={colors.textMuted} name="search-outline" size={19} />
              <TextInput
                onChangeText={setSearchQuery}
                placeholder="Search meals, restaurants, or bakeries"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Food types</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {foodFilters.map((filter) => {
                  const isActive = selectedFilter === filter.id;

                  return (
                    <Pressable
                      key={filter.id}
                      onPress={() => setSelectedFilter(filter.id)}
                      style={({ pressed }) => [
                        styles.filterButton,
                        isActive && styles.filterButtonActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.filterIcon, isActive && styles.filterIconActive]}>
                        <Ionicons
                          color={isActive ? colors.white : colors.primary}
                          name={filter.icon}
                          size={20}
                        />
                      </View>
                      <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.listIntro}>
              <Text style={styles.sectionTitle}>Available now</Text>
              <Text style={styles.listSubtitle}>
                Open an item for full details or add it directly to your cart.
              </Text>
            </View>
          </View>
        }
        columnWrapperStyle={columnCount > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.container, isMobile && styles.mobileContainer]}
        data={filteredListings}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        renderItem={({ item }) => {
          const isOwnListing =
            user?.role === 'businessOwner' && isBusinessOwnedByUser(item, user);
          const cartQuantity =
            cartEntries.find((entry) => entry.business.id === item.id)?.quantity ?? 0;
          const availableStock = getAvailableStock(item.id);

          return (
            <ProductCard
              addDisabled={isOwnListing}
              addLabel={isOwnListing ? 'Own' : 'Add'}
              business={item}
              maxQuantity={availableStock}
              onAddToCart={() => {
                if (!user) {
                  navigation.navigate('AuthPrompt');
                  return;
                }

                addToCart(item.id, user);
              }}
              onDecreaseQuantity={() => updateCartQuantity(item.id, cartQuantity - 1, user)}
              onIncreaseQuantity={() => {
                if (!user) {
                  navigation.navigate('AuthPrompt');
                  return;
                }

                addToCart(item.id, user);
              }}
              onPress={() => navigation.navigate('BusinessDetails', { businessId: item.id })}
              onProfilePress={() => {
                if (!user) {
                  navigation.navigate('AuthPrompt');
                  return;
                }

                if (item.ownerUserId) {
                  navigation.navigate('SellerProfile', { userId: item.ownerUserId });
                }
              }}
              quantity={cartQuantity}
              showQuantityControls
              style={columnCount > 1 ? styles.columnCard : undefined}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      gap: spacing.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    mobileContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    headerContent: {
      gap: spacing.lg,
      marginBottom: spacing.lg,
    },
    hero: {
      minHeight: 220,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      overflow: 'hidden',
      borderRadius: radii.lg,
      backgroundColor: colors.primary,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroCopy: {
      flex: 1,
      maxWidth: 720,
      gap: spacing.sm,
    },
    heroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 88,
      height: 88,
      borderRadius: 8,
      backgroundColor: colors.secondary,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#F5C84C',
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    subtitle: {
      ...typography.body,
      color: '#F1ECFA',
    },
    searchShell: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      ...shadows.soft,
    },
    searchInput: {
      ...typography.body,
      flex: 1,
      minWidth: 0,
      color: colors.text,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    filterRow: {
      gap: spacing.sm,
      paddingRight: spacing.md,
    },
    filterButton: {
      width: 118,
      minHeight: 104,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.sm,
    },
    filterButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    filterIcon: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    filterIconActive: {
      backgroundColor: colors.primary,
    },
    filterLabel: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '700',
      textAlign: 'center',
    },
    filterLabelActive: {
      color: colors.primary,
    },
    listIntro: {
      gap: 4,
    },
    listSubtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    columnWrapper: {
      gap: spacing.md,
    },
    columnCard: {
      flex: 1,
      minWidth: 0,
    },
    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.xl,
    },
    emptyTitle: {
      ...typography.subtitle,
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
