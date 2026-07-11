import { Ionicons } from '@expo/vector-icons';
import { createElement, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { BusinessDetailsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { BusinessMedia } from '../types/business';
import { getContactActions, openContactAction, openExternalUrl } from '../utils/contact';
import { formatCurrency } from '../utils/format';
import { isPublicBusiness } from '../utils/businessState';
import { normalizeProductCategory } from '../utils/category';

export function BusinessDetailsScreen({ navigation, route }: BusinessDetailsScreenProps) {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    addToCart,
    businesses,
    cartEntries,
    estates,
    getAvailableStock,
    getBusinessById,
    isBusinessOwnedByUser,
    isCustomerAdvertisement,
    isStoreOwnerListing,
    sendChatMessage,
    updateCartQuantity,
  } =
    useBusinessDirectory();
  const business = getBusinessById(route.params.businessId);
  const [activeVideo, setActiveVideo] = useState<BusinessMedia | null>(null);

  if (!business) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>Listing not found</Text>
        <Text style={styles.emptyText}>
          This product or service may have been removed from the marketplace.
        </Text>
      </View>
    );
  }

  const estate = estates.find((item) => item.id === business.estateId);
  const relatedBusinesses = businesses
    .filter(
      (item) =>
        item.listingType === business.listingType &&
        isPublicBusiness(item) &&
        isCustomerAdvertisement(item) === isCustomerAdvertisement(business) &&
        item.id !== business.id,
    )
    .slice(0, 3);
  const mediaCardWidth = Math.min(width - spacing.lg * 2, 360);
  const isProduct = business.listingType === 'product';
  const isAdvertisement = isCustomerAdvertisement(business);
  const isStoreProduct = isProduct && isStoreOwnerListing(business);
  const displayCategory = isProduct
    ? normalizeProductCategory(
        business.category,
        business.name,
        business.description,
        business.longDescription,
      )
    : business.category;
  const isAvailableToPublic = isPublicBusiness(business);
  const isOwnProduct =
    isStoreProduct && user?.role === 'businessOwner' && isBusinessOwnedByUser(business, user);
  const availableStock = isStoreProduct ? getAvailableStock(business.id) : 0;
  const cartQuantity =
    cartEntries.find((entry) => entry.business.id === business.id)?.quantity ?? 0;
  const isOutOfStock = isStoreProduct && availableStock <= 0;
  const isLowStock =
    isStoreProduct && !isOutOfStock && availableStock <= Math.max(1, business.reorderLevel ?? 0);
  const messageAdvertiser = () => {
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
  const contactAdvertiser = () => {
    const actions = getContactActions(business.contact);
    const preferredAction = actions.find((action) => action.id === 'whatsapp') ?? actions[0];

    if (preferredAction) {
      void openContactAction(preferredAction);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Image resizeMode="cover" source={{ uri: business.imageUrl }} style={styles.heroImage} />

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{business.name}</Text>
            <Text style={styles.subtitle}>
              {displayCategory} {isAdvertisement ? 'advertisement' : isProduct ? 'item' : 'service'} in{' '}
              {estate?.name ?? 'View2Connect Marketplace'}
            </Text>
          </View>
        {business.verified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons color={colors.primary} name="checkmark-circle" size={18} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}
      </View>

      {!isAvailableToPublic ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            {business.status === 'archived'
              ? 'Listing archived'
              : business.subscriptionStatus === 'pending'
                ? 'Awaiting customer care activation'
                : 'Awaiting admin approval'}
          </Text>
          <Text style={styles.noticeText}>
            {business.status === 'archived'
              ? 'This listing is not public right now. The owner can restore it from admin.'
              : business.subscriptionStatus === 'pending'
                ? 'This listing stays hidden until customer care activates the business profile.'
                : 'This listing has a live plan but still needs owner approval before it appears in the marketplace.'}
          </Text>
        </View>
      ) : null}

        <View style={styles.clusterStrip}>
          <View style={styles.clusterPill}>
            <Ionicons color={colors.primary} name="location-outline" size={16} />
            <Text style={styles.clusterPillText}>{estate?.city ?? 'Nigeria'}</Text>
          </View>
          {isStoreProduct ? (
            <View
              style={[
                styles.clusterPill,
                isOutOfStock && styles.clusterPillDanger,
                isLowStock && styles.clusterPillWarning,
              ]}
            >
              <Ionicons
                color={isOutOfStock || isLowStock ? colors.white : colors.primary}
                name={isOutOfStock ? 'alert-circle-outline' : 'cube-outline'}
                size={16}
              />
              <Text
                style={[
                  styles.clusterPillText,
                  (isOutOfStock || isLowStock) && styles.clusterPillTextInverted,
                ]}
              >
                {isOutOfStock
                  ? 'Out of stock'
                  : isLowStock
                    ? `${availableStock} left`
                    : `${availableStock} in stock`}
              </Text>
            </View>
          ) : null}
        </View>

        {isProduct ? (
          <View style={styles.priceBanner}>
            <Text style={styles.priceLabel}>
              {isAdvertisement ? 'Advertised price' : business.priceLabel ?? 'Price'}
            </Text>
            <Text style={styles.priceValue}>{formatCurrency(business.price)}</Text>
            <Text style={styles.priceMeta}>
              {isAdvertisement ? 'Contact advertiser directly' : business.responseTime}
            </Text>
          </View>
        ) : (
          <View style={styles.priceBanner}>
            <Text style={styles.priceLabel}>Service support</Text>
            <Text style={styles.priceValue}>Customer care</Text>
            <Text style={styles.priceMeta}>Use the support button if you need help with this service.</Text>
          </View>
        )}

        <Text style={styles.description}>{business.description}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Category</Text>
            <Text style={styles.statValue}>{displayCategory}</Text>
          </View>
          {isStoreProduct ? (
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Stock</Text>
              <Text style={styles.statValue}>
                {isOutOfStock
                  ? 'Out of stock'
                  : isLowStock
                    ? `${availableStock} left`
                    : `${availableStock} available`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gallery</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaTrack}
          >
            {business.media.map((item) => (
              <View key={item.id} style={[styles.mediaCard, { width: mediaCardWidth }]}>
                {item.type === 'image' ? (
                  <>
                    <Image resizeMode="cover" source={{ uri: item.url }} style={styles.mediaImage} />
                    <View style={styles.mediaFooter}>
                      <Text style={styles.mediaLabel}>{item.label}</Text>
                      <Text style={styles.mediaMeta}>Photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.videoCard}>
                    {item.thumbnailUrl ? (
                      <Image
                        resizeMode="cover"
                        source={{ uri: item.thumbnailUrl }}
                        style={styles.videoBackdrop}
                      />
                    ) : null}
                    <View style={styles.videoOverlay}>
                      <Ionicons color={colors.white} name="play-circle-outline" size={42} />
                      <Text style={styles.videoTitle}>{item.label}</Text>
                      <Text style={styles.videoCopy}>
                        Open this clip to view the product showcase or service walkthrough.
                      </Text>
                      <AppButton
                        label="Watch video"
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            setActiveVideo(item);
                            return;
                          }

                          void openExternalUrl(item.url, item.label);
                        }}
                        variant="secondary"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isAdvertisement ? 'Contact advertiser' : isProduct ? 'Buy this item' : 'Need help?'}
          </Text>
          <View style={styles.buttonGroup}>
            {isAdvertisement ? (
              <>
                <AppButton label="Message Advertiser" onPress={messageAdvertiser} />
                <AppButton label="Contact Advertiser" onPress={contactAdvertiser} variant="secondary" />
                {business.ownerUserId ? (
                  <AppButton
                    label="View Advertiser Profile"
                    onPress={() =>
                      navigation.navigate('SellerProfile', { userId: business.ownerUserId! })
                    }
                    variant="ghost"
                  />
                ) : null}
              </>
            ) : isStoreProduct ? (
              <View style={styles.quantityPanel}>
                <Text style={styles.noticeText}>
                  Select quantity. The cart cannot exceed available stock.
                </Text>
                <View style={[styles.quantityControl, isOwnProduct && styles.quantityControlDisabled]}>
                  <Pressable
                    disabled={cartQuantity <= 0 || isOwnProduct}
                    onPress={() => updateCartQuantity(business.id, cartQuantity - 1)}
                    style={({ pressed }) => [
                      styles.quantityButton,
                      pressed && styles.quantityButtonPressed,
                    ]}
                  >
                    <Text style={styles.quantitySymbol}>-</Text>
                  </Pressable>
                  <Text style={styles.quantityValue}>{cartQuantity}</Text>
                  <Pressable
                    disabled={
                      !isAvailableToPublic ||
                      isOutOfStock ||
                      isOwnProduct ||
                      cartQuantity >= availableStock
                    }
                    onPress={() => {
                      if (!user) {
                        navigation.navigate('AuthPrompt');
                        return;
                      }

                      addToCart(business.id);
                    }}
                    style={({ pressed }) => [
                      styles.quantityButton,
                      pressed && styles.quantityButtonPressed,
                    ]}
                  >
                    <Text style={styles.quantitySymbol}>+</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.noticeText}>
                Use the floating customer care button for service questions or support.
              </Text>
            )}
          </View>
        </View>

        <AppButton
          label="Back to marketplace"
          onPress={() => navigation.goBack()}
          variant="secondary"
        />
      </View>

      {relatedBusinesses.length > 0 ? (
        <View style={styles.relatedCard}>
          <Text style={styles.sectionTitle}>
            {isAdvertisement
              ? 'More advertisements'
              : isProduct
                ? 'More marketplace items'
                : 'More marketplace services'}
          </Text>
          {relatedBusinesses.map((item) => (
            <View key={item.id} style={styles.relatedRow}>
              <View style={styles.relatedCopy}>
                <Text style={styles.relatedName}>{item.name}</Text>
                <Text style={styles.relatedMeta}>
                  {item.listingType === 'product'
                    ? normalizeProductCategory(
                        item.category,
                        item.name,
                        item.description,
                        item.longDescription,
                      )
                    : item.category}
                </Text>
              </View>
              <AppButton
                label="View"
                onPress={() => navigation.replace('BusinessDetails', { businessId: item.id })}
                style={styles.relatedButton}
                variant="ghost"
              />
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(activeVideo)}
      onRequestClose={() => setActiveVideo(null)}
    >
      <View style={styles.videoModalBackdrop}>
        <View style={styles.videoModalCard}>
          <View style={styles.videoModalHeader}>
            <Text style={styles.videoModalTitle}>{activeVideo?.label ?? 'Listing video'}</Text>
            <Pressable
              onPress={() => setActiveVideo(null)}
              style={({ pressed }) => [styles.videoCloseButton, pressed && styles.ownerCardPressed]}
            >
              <Ionicons color={colors.text} name="close-outline" size={22} />
            </Pressable>
          </View>
          {activeVideo && Platform.OS === 'web'
            ? createElement('video', {
                src: activeVideo.url,
                controls: true,
                style: {
                  backgroundColor: '#000000',
                  borderRadius: 16,
                  maxHeight: 460,
                  width: '100%',
                },
              })
            : null}
          <AppButton label="Close" onPress={() => setActiveVideo(null)} variant="secondary" />
        </View>
      </View>
    </Modal>
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    heroImage: {
      height: 300,
      width: '100%',
      borderRadius: radii.xl,
    },
    card: {
      gap: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.card,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    copyBlock: {
      flex: 1,
      gap: spacing.xs,
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    verifiedBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    verifiedText: {
      ...typography.caption,
      color: colors.primary,
    },
    clusterStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    clusterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    clusterPillWarning: {
      backgroundColor: '#7A7A7A',
    },
    clusterPillDanger: {
      backgroundColor: colors.danger,
    },
    clusterPillText: {
      ...typography.caption,
      color: colors.primary,
    },
    clusterPillTextInverted: {
      color: colors.white,
    },
    priceBanner: {
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      padding: spacing.lg,
      gap: 4,
    },
    priceLabel: {
      ...typography.caption,
      color: '#D7EAE2',
    },
    priceValue: {
      ...typography.title,
      color: colors.white,
    },
    priceMeta: {
      ...typography.body,
      color: '#D6DFE2',
    },
    description: {
      ...typography.body,
      color: colors.textMuted,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    mediaTrack: {
      gap: spacing.md,
    },
    mediaCard: {
      overflow: 'hidden',
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.soft,
    },
    mediaImage: {
      height: 220,
      width: '100%',
    },
    mediaFooter: {
      gap: 4,
      padding: spacing.md,
    },
    mediaLabel: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    mediaMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    videoCard: {
      position: 'relative',
      minHeight: 260,
      overflow: 'hidden',
      backgroundColor: colors.overlay,
    },
    videoBackdrop: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.35,
    },
    videoOverlay: {
      gap: spacing.sm,
      justifyContent: 'center',
      minHeight: 260,
      padding: spacing.lg,
    },
    videoTitle: {
      ...typography.subtitle,
      color: colors.white,
    },
    videoCopy: {
      ...typography.body,
      color: '#D6DFE2',
    },
    videoModalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(8, 15, 18, 0.72)',
      padding: spacing.lg,
    },
    videoModalCard: {
      width: '100%',
      maxWidth: 760,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    videoModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    videoModalTitle: {
      ...typography.subtitle,
      flex: 1,
      color: colors.text,
    },
    videoCloseButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    statCard: {
      flex: 1,
      minWidth: 130,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 4,
    },
    statLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    statValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    serviceList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    servicePill: {
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    serviceText: {
      ...typography.body,
      color: colors.text,
    },
    ownerCard: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    ownerCardPressed: {
      opacity: 0.9,
    },
    ownerTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    ownerMeta: {
      ...typography.body,
      color: colors.textMuted,
    },
    buttonGroup: {
      gap: spacing.sm,
    },
    quantityPanel: {
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    quantityControl: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    quantityControlDisabled: {
      opacity: 0.55,
    },
    quantityButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      width: 44,
      backgroundColor: colors.primarySoft,
    },
    quantityButtonPressed: {
      opacity: 0.88,
    },
    quantitySymbol: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    quantityValue: {
      minWidth: 44,
      textAlign: 'center',
      ...typography.bodyStrong,
      color: colors.text,
    },
    contactButton: {
      width: '100%',
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    relatedCard: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    relatedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    relatedCopy: {
      flex: 1,
      gap: 4,
    },
    relatedName: {
      ...typography.subtitle,
      color: colors.text,
    },
    relatedMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    relatedButton: {
      minWidth: 88,
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
    noticeCard: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    noticeTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    noticeText: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
