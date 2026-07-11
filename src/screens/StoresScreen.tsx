import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Business, OwnerBusinessProfile } from '../types/business';
import { isPublicBusiness } from '../utils/businessState';
import {
  isStoreOwnerListing,
  profileMatchesBusiness,
} from '../utils/marketplaceListings';

const fallbackStoreImage =
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=700&q=82';

type StoreGroup = {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  listings: Business[];
  categories: string[];
  ownerUserId?: string;
};

function buildStoreGroups(
  businesses: Business[],
  profiles: OwnerBusinessProfile[],
): StoreGroup[] {
  const groups = new Map<string, StoreGroup>();

  businesses
    .filter((business) => isPublicBusiness(business) && isStoreOwnerListing(business, profiles))
    .forEach((business) => {
      const profile = profiles.find((item) => profileMatchesBusiness(item, business));
      const key =
        business.ownerUserId ||
        business.ownerEmail?.trim().toLowerCase() ||
        business.ownerName.trim().toLowerCase();
      const existing = groups.get(key);

      if (existing) {
        existing.listings.push(business);
        if (!existing.categories.includes(business.category)) {
          existing.categories.push(business.category);
        }
        return;
      }

      groups.set(key, {
        id: key,
        name: profile?.accountName || business.ownerName,
        address: profile?.address || business.address,
        imageUrl: profile?.coverImage || fallbackStoreImage,
        listings: [business],
        categories: [business.category],
        ...(business.ownerUserId ? { ownerUserId: business.ownerUserId } : {}),
      });
    });

  profiles
    .filter((profile) => Boolean(profile.riverParkVerified))
    .forEach((profile) => {
      const key =
        profile.ownerUserId ||
        profile.accountEmail.trim().toLowerCase() ||
        profile.ownerName.trim().toLowerCase();

      if (groups.has(key)) {
        return;
      }

      groups.set(key, {
        id: key,
        name: profile.ownerName || profile.accountName,
        address: profile.address || 'Digital store',
        imageUrl: profile.coverImage || fallbackStoreImage,
        listings: [],
        categories: ['Digital store'],
        ownerUserId: profile.ownerUserId,
      });
    });

  return [...groups.values()].sort(
    (left, right) => right.listings.length - left.listings.length || left.name.localeCompare(right.name),
  );
}

export function StoresScreen({ navigation }: MainTabsScreenProps<'Stores'>) {
  const { businesses, ownerBusinessProfiles } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const storeGroups = useMemo(
    () => buildStoreGroups(businesses, ownerBusinessProfiles),
    [businesses, ownerBusinessProfiles],
  );
  const visibleStores = useMemo(
    () =>
      storeGroups.filter((store) =>
        [store.name, store.address, ...store.categories]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [normalizedQuery, storeGroups],
  );
  const currentHour = new Date().getHours();
  const isOpen = currentHour >= 8 && currentHour < 20;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons color={colors.white} name="location-outline" size={22} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Find Stores Near You</Text>
          <Text style={styles.subtitle}>Browse approved stores and open their available items.</Text>
        </View>
      </View>

      <View style={styles.searchShell}>
        <Ionicons color={colors.textMuted} name="search-outline" size={20} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Search stores, areas, or categories"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={query}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stores Near You</Text>
        <Text style={styles.countText}>{visibleStores.length}</Text>
      </View>

      <View style={styles.storeList}>
        {visibleStores.map((store) => {
          const firstListing = store.listings[0];

          return (
            <View key={store.id} style={styles.storeCard}>
              <Image
                resizeMode="cover"
                source={{ uri: store.imageUrl || fallbackStoreImage }}
                style={styles.storeImage}
              />
              <View style={styles.storeBody}>
                <View style={styles.storeTitleRow}>
                  <View style={styles.storeTitleCopy}>
                    <Text numberOfLines={2} style={styles.storeName}>
                      {store.name}
                    </Text>
                    <View style={[styles.statusBadge, !isOpen && styles.closedBadge]}>
                      <View style={[styles.statusDot, !isOpen && styles.closedDot]} />
                      <Text style={[styles.statusText, !isOpen && styles.closedText]}>
                        {isOpen ? 'OPEN NOW' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>
                      {store.listings.length} item{store.listings.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons color={colors.textMuted} name="location-outline" size={18} />
                  <Text numberOfLines={2} style={styles.infoText}>
                    {store.address || 'Nigeria'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons color={colors.primary} name="grid-outline" size={18} />
                  <Text numberOfLines={1} style={styles.categoryText}>
                    {store.categories.join(' · ')}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (store.ownerUserId) {
                      navigation.navigate('SellerProfile', { userId: store.ownerUserId });
                    } else if (firstListing) {
                      navigation.navigate('BusinessDetails', { businessId: firstListing.id });
                    }
                  }}
                  style={({ pressed }) => [
                    styles.detailsButton,
                    pressed && styles.detailsButtonPressed,
                  ]}
                >
                  <Text style={styles.detailsText}>View store</Text>
                  <Ionicons color={colors.primary} name="chevron-forward" size={18} />
                </Pressable>
              </View>
            </View>
          );
        })}

        {visibleStores.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons color={colors.primary} name="storefront-outline" size={32} />
            <Text style={styles.emptyTitle}>No approved stores found</Text>
            <Text style={styles.emptyCopy}>Try another store name, location, or category.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.lg,
    },
    headerIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    headerCopy: {
      flex: 1,
      gap: 3,
    },
    title: {
      ...typography.section,
      color: colors.text,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textMuted,
    },
    searchShell: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      ...shadows.soft,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: 16,
      paddingVertical: spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    countText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    storeList: {
      gap: spacing.md,
    },
    storeCard: {
      overflow: 'hidden',
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.soft,
    },
    storeImage: {
      width: 150,
      minHeight: 220,
      flexGrow: 0,
      backgroundColor: colors.card,
    },
    storeBody: {
      flex: 1,
      minWidth: 210,
      gap: spacing.md,
      padding: spacing.lg,
    },
    storeTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    storeTitleCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    storeName: {
      ...typography.subtitle,
      color: colors.text,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radii.pill,
      backgroundColor: '#E8F7EC',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    closedBadge: {
      backgroundColor: '#FFF0F0',
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#2EAF59',
    },
    closedDot: {
      backgroundColor: colors.danger,
    },
    statusText: {
      ...typography.caption,
      color: '#237C40',
      fontWeight: '800',
    },
    closedText: {
      color: colors.danger,
    },
    itemCountBadge: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    itemCountText: {
      ...typography.caption,
      color: colors.primary,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    infoText: {
      ...typography.body,
      flex: 1,
      color: colors.textMuted,
    },
    categoryText: {
      ...typography.bodyStrong,
      flex: 1,
      color: colors.primary,
    },
    detailsButton: {
      minHeight: 42,
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
    },
    detailsButtonPressed: {
      opacity: 0.86,
    },
    detailsText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.xxl,
    },
    emptyTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    emptyCopy: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
