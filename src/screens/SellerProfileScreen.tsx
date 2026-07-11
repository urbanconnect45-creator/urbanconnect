import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AdvertisementCard } from '../components/AdvertisementCard';
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
import { getContactActions, openContactAction } from '../utils/contact';

export function SellerProfileScreen({ navigation, route }: SellerProfileScreenProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const { findUserById, user } = useAuth();
  const {
    addToCart,
    businesses,
    cartEntries,
    getAvailableStock,
    isBusinessOwnedByUser,
    isCustomerAdvertisement,
    isStoreOwnerListing,
    sendChatMessage,
    updateCartQuantity,
  } = useBusinessDirectory();
  const seller = findUserById(route.params.userId);
  const profileListings = businesses.filter(
    (business) =>
      isPublicBusiness(business) &&
      [business.ownerUserId, business.ownerEmail, business.ownerName]
        .map((key) => key?.trim().toLowerCase())
        .includes(route.params.userId.trim().toLowerCase()),
  );
  const profileSeed = profileListings[0];

  if (!seller && !profileSeed) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>Profile not found</Text>
        <Text style={styles.emptyText}>
          This store or advertiser profile may no longer be available.
        </Text>
      </View>
    );
  }

  const sellerListings = seller
    ? businesses.filter(
        (business) => business.ownerUserId === seller.id && isPublicBusiness(business),
      )
    : profileListings;
  const profileBusiness = sellerListings[0] ?? null;
  const isStoreOwnerProfile = seller?.role === 'businessOwner' || sellerListings.some(isStoreOwnerListing);
  const productListings = sellerListings.filter((business) =>
    isStoreOwnerProfile
      ? business.listingType === 'product' && isStoreOwnerListing(business)
      : isCustomerAdvertisement(business),
  );
  const serviceListing = isStoreOwnerProfile
    ? sellerListings.find((business) => business.listingType === 'profession')
    : undefined;
  const advertisementServices = isStoreOwnerProfile
    ? []
    : sellerListings.filter(
        (business) => business.listingType === 'profession' && isCustomerAdvertisement(business),
      );
  const avatarSource = profileBusiness?.imageUrl;
  const displayName = seller?.businessName ?? seller?.fullName ?? profileSeed?.ownerName ?? 'Advertiser';
  const contactBusiness = profileBusiness ?? profileSeed;
  const gridCardWidth = width >= 900 ? '48%' : '100%';
  const messageAdvertiser = (business: typeof sellerListings[number]) => {
    if (!user) {
      navigation.navigate('AuthPrompt');
      return;
    }

    sendChatMessage(
      business.id,
      user,
      `Hi ${business.ownerName}, I am interested in your advertisement: ${business.name}.`,
    );
    navigation.navigate('Chats');
  };
  const contactAdvertiser = (business: typeof sellerListings[number]) => {
    const actions = getContactActions(business.contact);
    const preferredAction = actions.find((action) => action.id === 'whatsapp') ?? actions[0];

    if (preferredAction) {
      void openContactAction(preferredAction);
    }
  };

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
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>
                {isStoreOwnerProfile ? 'Store profile' : 'Advertiser profile'}
              </Text>
              <Text style={styles.title}>{displayName}</Text>
              <Text style={styles.subtitle}>
                {isStoreOwnerProfile
                  ? `${seller?.fullName ?? displayName} - ${seller?.businessCluster ?? 'Marketplace store'}`
                  : `${profileBusiness?.description ?? 'Direct contact classified advertiser.'}`}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons color={colors.white} name="storefront-outline" size={16} />
              <Text style={styles.metaText}>
                {formatNumber(productListings.length)} {isStoreOwnerProfile ? 'products' : 'ads'}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons color={colors.white} name="briefcase-outline" size={16} />
              <Text style={styles.metaText}>
                {isStoreOwnerProfile
                  ? serviceListing
                    ? '1 service'
                    : 'No service'
                  : `${formatNumber(advertisementServices.length)} services`}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons color={colors.white} name="location-outline" size={16} />
              <Text style={styles.metaText}>
                {isStoreOwnerProfile ? 'Verified marketplace store' : profileBusiness?.address ?? 'Direct advertiser'}
              </Text>
            </View>
          </View>
        </View>

        {profileBusiness ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {isStoreOwnerProfile ? 'Store overview' : 'Advertiser overview'}
            </Text>
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
              {isStoreOwnerProfile
                ? 'This store profile contains approved products that can be ordered through View2Connect.'
                : 'This advertiser profile is for direct contact. Ads do not use cart, checkout, delivery, or withdrawal.'}
            </Text>
            {!isStoreOwnerProfile && contactBusiness ? (
              <View style={styles.contactGrid}>
                <Text style={styles.infoValue}>Phone: {contactBusiness.contact.phone}</Text>
                {contactBusiness.contact.whatsapp ? (
                  <Text style={styles.infoValue}>WhatsApp: {contactBusiness.contact.whatsapp}</Text>
                ) : null}
                <Text style={styles.infoValue}>Email: {contactBusiness.contact.email}</Text>
                {contactBusiness.contact.instagram ? (
                  <Text style={styles.infoValue}>Instagram: {contactBusiness.contact.instagram}</Text>
                ) : null}
                {contactBusiness.contact.facebook ? (
                  <Text style={styles.infoValue}>Facebook: {contactBusiness.contact.facebook}</Text>
                ) : null}
                {contactBusiness.contact.x ? (
                  <Text style={styles.infoValue}>X: {contactBusiness.contact.x}</Text>
                ) : null}
                {contactBusiness.contact.tiktok ? (
                  <Text style={styles.infoValue}>TikTok: {contactBusiness.contact.tiktok}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>No live profile yet</Text>
            <Text style={styles.bodyText}>
              This business has no approved marketplace listings yet.
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
              onProfilePress={() =>
                navigation.navigate('SellerProfile', {
                  userId: seller?.id ?? serviceListing.ownerUserId ?? route.params.userId,
                })
              }
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isStoreOwnerProfile ? 'Store products' : 'Advertisements'}
          </Text>
          {productListings.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.bodyText}>
                {isStoreOwnerProfile
                  ? 'No approved products from this store yet.'
                  : 'No approved advertisements from this advertiser yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.productGrid}>
              {productListings.map((business) => {
                const isOwnListing =
                  user?.role === 'businessOwner' && isBusinessOwnedByUser(business, user);
                const cartQuantity =
                  cartEntries.find((entry) => entry.business.id === business.id)?.quantity ?? 0;
                const availableStock = getAvailableStock(business.id);

                return isStoreOwnerProfile ? (
                  <ProductCard
                    addDisabled={isOwnListing}
                    addLabel={isOwnListing ? 'Own' : 'Add'}
                    key={business.id}
                    business={business}
                    maxQuantity={availableStock}
                    onAddToCart={() => addToCart(business.id)}
                    onDecreaseQuantity={() => updateCartQuantity(business.id, cartQuantity - 1)}
                    onIncreaseQuantity={() => addToCart(business.id)}
                    onPress={() => navigation.navigate('BusinessDetails', { businessId: business.id })}
                    onProfilePress={() =>
                      navigation.navigate('SellerProfile', {
                        userId: seller?.id ?? business.ownerUserId ?? route.params.userId,
                      })
                    }
                    quantity={cartQuantity}
                    showQuantityControls
                    style={[styles.productGridCard, { width: gridCardWidth }]}
                  />
                ) : (
                  <AdvertisementCard
                    advertisement={business}
                    key={business.id}
                    onContactPress={() => contactAdvertiser(business)}
                    onMessagePress={() => messageAdvertiser(business)}
                    onPress={() => navigation.navigate('BusinessDetails', { businessId: business.id })}
                    onProfilePress={() =>
                      navigation.navigate('SellerProfile', {
                        userId: business.ownerUserId ?? route.params.userId,
                      })
                    }
                    style={[styles.productGridCard, { width: gridCardWidth }]}
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
    productGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    productGridCard: {
      minWidth: 240,
    },
    contactGrid: {
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
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
