import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { ProductCard } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { productCategories } from '../types/business';
import { normalizeProductCategory } from '../utils/category';
import { formatNumber } from '../utils/format';
import { getBusinessPriorityScore, isPublicBusiness } from '../utils/businessState';

export function DashboardScreen({ navigation }: MainTabsScreenProps<'Dashboard'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { businesses, addToCart, isBusinessOwnedByUser } = useBusinessDirectory();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = width < 780;

  const productListings = useMemo(
    () =>
      businesses
        .filter(
          (business) =>
            business.listingType === 'product' &&
            isPublicBusiness(business),
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
        .sort(
          (leftBusiness, rightBusiness) =>
            getBusinessPriorityScore(rightBusiness) - getBusinessPriorityScore(leftBusiness),
        ),
    [businesses],
  );
  const availableCategories = useMemo(
    () => ['All', ...productCategories],
    [],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [availableCategories, selectedCategory]);

  const filteredProducts = productListings.filter((business) => {
    const matchesCategory =
      selectedCategory === 'All' ? true : business.category === selectedCategory;
    const matchesSearch =
      normalizedQuery.length === 0
        ? true
        : [
            business.name,
            business.description,
            business.category,
            business.address,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });
  const columnCount = width >= 1280 ? 3 : 2;

  return (
    <View style={styles.screen}>
      <FlatList
        key={`marketplace-${columnCount}`}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No products match that search yet.</Text>
            <Text style={styles.emptyText}>
              Try another category or search by item name.
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={[styles.hero, isMobile && styles.heroMobile]}>
              <Text style={styles.eyebrow}>View2Connect marketplace</Text>
              <Text style={[styles.title, isMobile && styles.titleMobile]}>
                {user?.fullName
                  ? `Shop local stores, ${user.fullName.split(' ')[0]}.`
                  : 'Shop products from trusted local stores.'}
              </Text>
              <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
                Find approved items, add them to cart, and follow each order through pickup and
                delivery.
              </Text>
              <View style={[styles.heroStats, isMobile && styles.heroStatsMobile]}>
                <View style={styles.heroStat}>
                  <Ionicons color={colors.warning} name="ribbon-outline" size={18} />
                  <Text style={styles.heroStatValue}>{formatNumber(productListings.length)}</Text>
                  <Text style={styles.heroStatLabel}>Gold products</Text>
                </View>
                <View style={styles.heroStat}>
                  <Ionicons color={colors.secondary} name="albums-outline" size={18} />
                  <Text style={styles.heroStatValue}>
                    {formatNumber(Math.max(1, availableCategories.length - 1))}
                  </Text>
                  <Text style={styles.heroStatLabel}>Categories</Text>
                </View>
                <View style={styles.heroStat}>
                  <Ionicons color={colors.primary} name="restaurant-outline" size={18} />
                  <Text style={styles.heroStatValue}>Food</Text>
                  <Text style={styles.heroStatLabel}>Meals and drinks</Text>
                </View>
              </View>

              <View style={[styles.heroActions, isMobile && styles.heroActionsMobile]}>
                <AppButton
                  label="Browse food"
                  onPress={() => navigation.navigate('Food')}
                  variant="secondary"
                />
                <AppButton
                  label="Browse categories"
                  onPress={() => navigation.navigate('Professions')}
                  variant="ghost"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search items</Text>
              <View style={[styles.sectionPanel, isMobile && styles.sectionPanelMobile]}>
                <View style={styles.searchShell}>
                  <Ionicons color={colors.textMuted} name="search-outline" size={18} />
                  <TextInput
                    onChangeText={setSearchQuery}
                    placeholder="Search items or categories"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    value={searchQuery}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Filter by category</Text>
              <View style={[styles.sectionPanel, isMobile && styles.sectionPanelMobile]}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalRow}
                >
                  {availableCategories.map((category) => {
                    const isActive = category === selectedCategory;

                    return (
                      <Text
                        key={category}
                        onPress={() => setSelectedCategory(category)}
                        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      >
                        {category}
                      </Text>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.listIntro}>
              <Text style={styles.sectionTitle}>Products from local stores</Text>
              <Text style={styles.listSubtitle}>
                Open an item for details or add it straight to cart.
              </Text>
            </View>
          </View>
        }
        columnWrapperStyle={columnCount > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.container, isMobile && styles.mobileContainer]}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        renderItem={({ item }) => {
          const isOwnListing =
            user?.role === 'businessOwner' && isBusinessOwnedByUser(item, user);

          return (
            <ProductCard
              addDisabled={isOwnListing}
              addLabel={isOwnListing ? 'Own' : 'Add'}
              business={item}
              onAddToCart={() => {
                if (!user) {
                  navigation.navigate('AuthPrompt');
                  return;
                }

                addToCart(item.id);
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
      paddingBottom: spacing.xxl,
    },
    mobileContainer: {
      paddingBottom: spacing.lg,
    },
    headerContent: {
      gap: spacing.lg,
      paddingBottom: spacing.sm,
    },
    hero: {
      position: 'relative',
      overflow: 'hidden',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroMobile: {
      gap: spacing.sm,
      borderRadius: 8,
      padding: spacing.lg,
    },
    heroOrbOne: {
      position: 'absolute',
      top: -30,
      right: -10,
      height: 138,
      width: 138,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.3)',
    },
    heroOrbTwo: {
      position: 'absolute',
      bottom: -52,
      left: -20,
      height: 170,
      width: 170,
      borderRadius: 999,
      backgroundColor: 'rgba(58, 144, 158, 0.26)',
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#D7EAE2',
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    titleMobile: {
      fontSize: 25,
      lineHeight: 31,
    },
    subtitle: {
      ...typography.body,
      color: '#D6DFE2',
      maxWidth: 720,
    },
    subtitleMobile: {
      fontSize: 14,
      lineHeight: 21,
    },
    heroActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    heroActionsMobile: {
      gap: spacing.xs,
    },
    heroStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    heroStatsMobile: {
      display: 'none',
    },
    heroStat: {
      flexGrow: 1,
      minWidth: 132,
      gap: 2,
      borderRadius: radii.lg,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    heroStatValue: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    heroStatLabel: {
      ...typography.caption,
      color: '#D6DFE2',
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    sectionPanel: {
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    sectionPanelMobile: {
      borderRadius: 8,
      padding: spacing.sm,
    },
    searchShell: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      ...typography.body,
    },
    horizontalRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    categoryChip: {
      overflow: 'hidden',
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.bodyStrong,
    },
    categoryChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      color: colors.primary,
    },
    listIntro: {
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    listSubtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    columnWrapper: {
      gap: spacing.lg,
    },
    columnCard: {
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.soft,
    },
    emptyTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
