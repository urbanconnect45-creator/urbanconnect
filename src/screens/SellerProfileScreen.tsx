import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { ProductCard } from '../components/ProductCard';
import { ProfessionCard } from '../components/ProfessionCard';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { SellerProfileScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatNumber } from '../utils/format';
import { isPublicBusiness } from '../utils/businessState';

export function SellerProfileScreen({ navigation, route }: SellerProfileScreenProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { findUserById, user } = useAuth();
  const { addToCart, businesses, isBusinessOwnedByUser } = useBusinessDirectory();
  const seller = findUserById(route.params.userId);

  if (!seller) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>Business profile not found</Text>
        <Text style={styles.emptyText}>
          This River Park profile may no longer be available.
        </Text>
      </View>
    );
  }

  const sellerListings = businesses.filter(
    (business) => business.ownerUserId === seller.id && isPublicBusiness(business),
  );
  const profileBusiness = sellerListings[0] ?? null;
  const productListings = sellerListings.filter((business) => business.listingType === 'product');
  const serviceListing = sellerListings.find((business) => business.listingType === 'profession');
  const avatarSource = profileBusiness?.imageUrl;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroHeader}>
            {avatarSource ? (
              <Image resizeMode="cover" source={{ uri: avatarSource }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {seller.firstName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Business profile</Text>
              <Text style={styles.title}>{seller.businessName ?? seller.fullName}</Text>
              <Text style={styles.subtitle}>
                {seller.fullName} - {seller.businessCluster ?? 'River Park'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons color={colors.white} name="storefront-outline" size={16} />
              <Text style={styles.metaText}>{formatNumber(productListings.length)} products</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons color={colors.white} name="briefcase-outline" size={16} />
              <Text style={styles.metaText}>{serviceListing ? '1 service' : 'No service'}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons color={colors.white} name="location-outline" size={16} />
              <Text style={styles.metaText}>River Park only</Text>
            </View>
          </View>
        </View>

        {profileBusiness ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Business overview</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoPill}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{profileBusiness.category}</Text>
              </View>
              <View style={styles.infoPill}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoValue}>
                  {profileBusiness.verified ? 'Verified' : 'Pending'}
                </Text>
              </View>
              <View style={styles.infoPill}>
                <Text style={styles.infoLabel}>Cluster</Text>
                <Text style={styles.infoValue}>{profileBusiness.cluster}</Text>
              </View>
            </View>
            <Text style={styles.bodyText}>
              This profile is public for browsing only. Use customer care for order, delivery, or
              service support.
            </Text>

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaRow}
            >
              {profileBusiness.media
                .filter((item) => item.type === 'image')
                .slice(0, 4)
                .map((item) => (
                  <Image
                    key={item.id}
                    resizeMode="cover"
                    source={{ uri: item.url }}
                    style={styles.mediaImage}
                  />
                ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>No live profile yet</Text>
            <Text style={styles.bodyText}>
              This business has no approved River Park listings yet.
            </Text>
          </View>
        )}

        {serviceListing ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service</Text>
            <ProfessionCard
              actionLabel="View"
              business={serviceListing}
              onActionPress={() =>
                navigation.navigate('BusinessDetails', { businessId: serviceListing.id })
              }
              onPress={() => navigation.navigate('BusinessDetails', { businessId: serviceListing.id })}
              onProfilePress={() => navigation.navigate('SellerProfile', { userId: seller.id })}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products</Text>
          {productListings.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.bodyText}>No approved products from this business yet.</Text>
            </View>
          ) : (
            <View style={styles.cardStack}>
              {productListings.map((business) => {
                const isOwnListing =
                  user?.role === 'businessOwner' && isBusinessOwnedByUser(business, user);

                return (
                  <ProductCard
                    addDisabled={isOwnListing}
                    addLabel={isOwnListing ? 'Own' : 'Add'}
                    key={business.id}
                    business={business}
                    onAddToCart={() => addToCart(business.id)}
                    onPress={() => navigation.navigate('BusinessDetails', { businessId: business.id })}
                    onProfilePress={() => navigation.navigate('SellerProfile', { userId: seller.id })}
                  />
                );
              })}
            </View>
          )}
        </View>

        <AppButton label="Back" onPress={() => navigation.goBack()} variant="secondary" />
      </ScrollView>

    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    hero: {
      position: 'relative',
      overflow: 'hidden',
      gap: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroGlowOne: {
      position: 'absolute',
      top: -30,
      right: -8,
      height: 138,
      width: 138,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.28)',
    },
    heroGlowTwo: {
      position: 'absolute',
      bottom: -44,
      left: -18,
      height: 160,
      width: 160,
      borderRadius: 999,
      backgroundColor: 'rgba(58, 144, 158, 0.24)',
    },
    heroHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      alignItems: 'center',
    },
    avatarImage: {
      height: 88,
      width: 88,
      borderRadius: 44,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.24)',
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 88,
      width: 88,
      borderRadius: 44,
      backgroundColor: colors.secondary,
    },
    avatarFallbackText: {
      ...typography.section,
      color: colors.white,
    },
    heroCopy: {
      flex: 1,
      gap: spacing.xs,
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
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.overlayMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaText: {
      ...typography.caption,
      color: colors.white,
    },
    section: {
      gap: spacing.md,
    },
    card: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    infoPill: {
      minWidth: 140,
      flex: 1,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    infoLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    infoValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    mediaRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    mediaImage: {
      height: 92,
      width: 118,
      borderRadius: radii.md,
    },
    cardStack: {
      gap: spacing.md,
    },
    emptyShell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    emptyTitle: {
      ...typography.section,
      color: colors.text,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
