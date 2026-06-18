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
import { formatNumber } from '../utils/format';
import { getBusinessPriorityScore, isPublicBusiness } from '../utils/businessState';

export function DashboardScreen({ navigation }: MainTabsScreenProps<'Dashboard'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { businesses, currentEstateId, estates, addToCart, isBusinessOwnedByUser } =
    useBusinessDirectory();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = width < 780;

  const selectedEstate = estates.find((estate) => estate.id === currentEstateId) ?? estates[0];
  const productListings = useMemo(
    () =>
      businesses
        .filter(
          (business) =>
            business.estateId === selectedEstate?.id &&
            business.listingType === 'product' &&
            isPublicBusiness(business),
        )
        .sort(
          (leftBusiness, rightBusiness) =>
            getBusinessPriorityScore(rightBusiness) - getBusinessPriorityScore(leftBusiness),
        ),
    [businesses, selectedEstate?.id],
  );
  const availableCategories = useMemo(
    () => ['All', ...new Set(productListings.map((business) => business.category))],
    [productListings],
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
            business.ownerName,
            business.address,
            business.cluster,
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
              Try another category or search by seller, cluster, or item name.
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <View style={styles.heroOrbOne} />
              <View style={styles.heroOrbTwo} />
              <Text style={styles.eyebrow}>River Park shop</Text>
              <Text style={styles.title}>
                {user?.fullName
                  ? `Shop River Park, ${user.fullName.split(' ')[0]}.`
                  : 'Shop approved products inside River Park.'}
              </Text>
              <Text style={styles.subtitle}>
                Find approved items, add them to cart, and let customer care coordinate pickup and
                delivery inside the estate.
              </Text>
              <View style={styles.heroStats}>
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
                  <Ionicons color={colors.primary} name="headset-outline" size={18} />
                  <Text style={styles.heroStatValue}>Care</Text>
                  <Text style={styles.heroStatLabel}>Delivery help</Text>
                </View>
              </View>

              <View style={styles.heroActions}>
                <AppButton
                  label="Browse services"
                  onPress={() => navigation.navigate('Professions')}
                  variant="secondary"
                />
                {user?.role === 'businessOwner' ? (
                  <AppButton
                    label="Create listing"
                    onPress={() => navigation.navigate('RegisterBusiness')}
                    variant="ghost"
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search items</Text>
              <View style={styles.sectionPanel}>
                <View style={styles.searchShell}>
                  <Ionicons color={colors.textMuted} name="search-outline" size={18} />
                  <TextInput
                    onChangeText={setSearchQuery}
                    placeholder="Search items, sellers, clusters, or categories"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    value={searchQuery}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Filter by category</Text>
              <View style={styles.sectionPanel}>
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
              <Text style={styles.sectionTitle}>Products in River Park</Text>
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
              onAddToCart={() => addToCart(item.id)}
              onPress={() => navigation.navigate('BusinessDetails', { businessId: item.id })}
              onProfilePress={() => {
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
    subtitle: {
      ...typography.body,
      color: '#D6DFE2',
      maxWidth: 720,
    },
    heroActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    heroStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
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
