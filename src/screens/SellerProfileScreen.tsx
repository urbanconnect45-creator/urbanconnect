import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { showProfileContact } from '../utils/contact';
import { getProfileContactForBusiness, profileMatchesBusiness } from '../utils/marketplaceListings';

export function SellerProfileScreen({ navigation, route }: SellerProfileScreenProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { findUserById, user } = useAuth();
  const {
    addToCart,
    businesses,
    cartEntries,
    getAvailableStock,
    isBusinessOwnedByUser,
    isCustomerAdvertisement,
    isStoreOwnerListing,
    ownerBusinessProfiles,
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
  const contactBusiness = profileBusiness ?? profileSeed;
  const profileOwnerKeys = [
    route.params.userId,
    seller?.id,
    seller?.email,
    seller?.fullName,
    seller?.businessName,
    contactBusiness?.ownerUserId,
    contactBusiness?.ownerEmail,
    contactBusiness?.ownerName,
  ]
    .map((key) => key?.trim().toLowerCase())
    .filter((key): key is string => Boolean(key));
  const ownerProfile = ownerBusinessProfiles.find((profile) => {
    const profileKeys = [
      profile.ownerUserId,
      profile.accountEmail,
      profile.email,
      profile.accountName,
      profile.ownerName,
    ]
      .map((key) => key?.trim().toLowerCase())
      .filter(Boolean);

    return (
      profileKeys.some((key) => profileOwnerKeys.includes(key)) ||
      Boolean(contactBusiness && profileMatchesBusiness(profile, contactBusiness))
    );
  });
  const avatarSource = ownerProfile?.profileImage || undefined;
  const coverSource = ownerProfile?.coverImage || undefined;
  const advertiserBio = ownerProfile?.bio?.trim();
  const displayName =
    ownerProfile?.accountName ??
    seller?.businessName ??
    seller?.fullName ??
    profileSeed?.ownerName ??
    'Advertiser';
  const profileContact = contactBusiness
    ? getProfileContactForBusiness(contactBusiness, ownerBusinessProfiles)
    : undefined;
  const socialRows = [
    {
      id: 'instagram',
      label: 'Instagram',
      icon: 'logo-instagram' as const,
      color: '#E1306C',
      backgroundColor: '#FDE7F0',
      value: ownerProfile?.instagram?.trim() || 'Not yet added',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'logo-facebook' as const,
      color: '#1877F2',
      backgroundColor: '#E8F1FF',
      value: ownerProfile?.facebook?.trim() || 'Not yet added',
    },
    {
      id: 'x',
      label: 'X',
      icon: 'logo-twitter' as const,
      color: '#111827',
      backgroundColor: '#EEF0F3',
      value: ownerProfile?.x?.trim() || 'Not yet added',
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      icon: 'musical-notes-outline' as const,
      color: '#00A6A6',
      backgroundColor: '#E5FAFA',
      value: ownerProfile?.tiktok?.trim() || 'Not yet added',
    },
  ];
  const gridCardWidth = '48%';
  const messageAdvertiser = (business: typeof sellerListings[number]) => {
    if (!user) {
      navigation.navigate('AuthPrompt');
      return;
    }

    if (business.ownerUserId === user.id) {
      Alert.alert('This is your advert', 'You cannot message yourself about your own advert.');
      return;
    }

    void sendChatMessage(
      business.id,
      user,
      `Hi ${business.ownerName}, I am interested in your advertisement: ${business.name}.`,
    ).catch(() => undefined);
    navigation.navigate('Chats');
  };
  const contactAdvertiser = (business: typeof sellerListings[number]) => {
    showProfileContact(
      getProfileContactForBusiness(business, ownerBusinessProfiles),
      `${business.ownerName} contact`,
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          {coverSource ? (
            <Image resizeMode="cover" source={{ uri: coverSource }} style={styles.coverImage} />
          ) : null}
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
                  : `${advertiserBio || profileBusiness?.description || 'Direct contact classified advertiser.'}`}
              </Text>
            </View>
          </View>

          {isStoreOwnerProfile ? (
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons color={colors.white} name="storefront-outline" size={16} />
                <Text style={styles.metaText}>
                  {formatNumber(productListings.length)} products
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons color={colors.white} name="briefcase-outline" size={16} />
                <Text style={styles.metaText}>
                  {serviceListing ? '1 service' : 'No service'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons color={colors.white} name="location-outline" size={16} />
                <Text style={styles.metaText}>Verified marketplace store</Text>
              </View>
            </View>
          ) : null}
        </View>

        {profileBusiness ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {isStoreOwnerProfile ? 'Store overview' : 'Advertiser overview'}
            </Text>
            {isStoreOwnerProfile ? (
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
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{ownerProfile?.address || profileBusiness.address}</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.bodyText}>
              {isStoreOwnerProfile
                ? 'This store profile contains approved products that can be ordered through View2Connect.'
                : advertiserBio || 'This advertiser profile is for direct contact. Ads do not use cart, checkout, delivery, or withdrawal.'}
            </Text>
            {!isStoreOwnerProfile && profileContact ? (
              <View style={styles.contactGrid}>
                <Text style={styles.infoValue}>Phone: {profileContact.phone}</Text>
                {profileContact.whatsapp ? (
                  <Text style={styles.infoValue}>WhatsApp: {profileContact.whatsapp}</Text>
                ) : null}
                <Text style={styles.infoValue}>Email: {profileContact.email}</Text>
                <View style={styles.socialGrid}>
                  {socialRows.map((social) => (
                    <View key={social.id} style={styles.socialCard}>
                      <View
                        style={[
                          styles.socialIconShell,
                          { backgroundColor: social.backgroundColor },
                        ]}
                      >
                        <Ionicons color={social.color} name={social.icon} size={19} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.socialLabel,
                          social.value === 'Not yet added' && styles.socialValueMissing,
                        ]}
                      >
                        {social.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.socialValue,
                          social.value === 'Not yet added' && styles.socialValueMissing,
                        ]}
                      >
                        {social.value}
                      </Text>
                    </View>
                  ))}
                </View>
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
                  user?.role === 'businessOwner'
                    ? isBusinessOwnedByUser(business, user)
                    : Boolean(user && business.ownerUserId === user.id);
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
                    onAddToCart={() => addToCart(business.id, user)}
                    onDecreaseQuantity={() => updateCartQuantity(business.id, cartQuantity - 1, user)}
                    onIncreaseQuantity={() => addToCart(business.id, user)}
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
                    advertiserProfileImage={ownerProfile?.profileImage || undefined}
                    key={business.id}
                    ownListing={isOwnListing}
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
    coverImage: {
      height: 190,
      width: '100%',
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
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
      flex: 0,
      flexBasis: '48%',
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 0,
    },
    contactGrid: {
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    socialGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    socialCard: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      width: 118,
      minHeight: 104,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    socialIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
    },
    socialLabel: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '800',
      textAlign: 'center',
    },
    socialValue: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '700',
      maxWidth: '100%',
      textAlign: 'center',
    },
    socialValueMissing: {
      color: colors.textMuted,
      fontWeight: '500',
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
