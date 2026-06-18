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
import { openExternalUrl } from '../utils/contact';
import { formatCurrency } from '../utils/format';
import { isPublicBusiness } from '../utils/businessState';

export function BusinessDetailsScreen({ navigation, route }: BusinessDetailsScreenProps) {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { addToCart, businesses, estates, getAvailableStock, getBusinessById, isBusinessOwnedByUser } =
    useBusinessDirectory();
  const business = getBusinessById(route.params.businessId);
  const [activeVideo, setActiveVideo] = useState<BusinessMedia | null>(null);

  if (!business) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>Listing not found</Text>
        <Text style={styles.emptyText}>
          This product or service may have been removed from the River Park shop.
        </Text>
      </View>
    );
  }

  const estate = estates.find((item) => item.id === business.estateId);
  const relatedBusinesses = businesses
    .filter(
      (item) =>
        item.estateId === business.estateId &&
        item.listingType === business.listingType &&
        isPublicBusiness(item) &&
        item.id !== business.id,
    )
    .slice(0, 3);
  const mediaCardWidth = Math.min(width - spacing.lg * 2, 360);
  const isProduct = business.listingType === 'product';
  const isAvailableToPublic = isPublicBusiness(business);
  const isOwnProduct =
    isProduct && user?.role === 'businessOwner' && isBusinessOwnedByUser(business, user);
  const availableStock = isProduct ? getAvailableStock(business.id) : 0;
  const isOutOfStock = isProduct && availableStock <= 0;
  const isLowStock =
    isProduct && !isOutOfStock && availableStock <= Math.max(1, business.reorderLevel ?? 0);

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Image resizeMode="cover" source={{ uri: business.imageUrl }} style={styles.heroImage} />

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{business.name}</Text>
            <Text style={styles.subtitle}>
              {business.category} {isProduct ? 'item' : 'service'} in{' '}
              {estate?.name ?? 'River Park'}
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
            <Ionicons color={colors.primary} name="layers-outline" size={16} />
            <Text style={styles.clusterPillText}>{business.cluster}</Text>
          </View>
          <View style={styles.clusterPill}>
            <Ionicons color={colors.primary} name="location-outline" size={16} />
            <Text style={styles.clusterPillText}>River Park</Text>
          </View>
          {isProduct ? (
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
            <Text style={styles.priceLabel}>{business.priceLabel ?? 'Price'}</Text>
            <Text style={styles.priceValue}>{formatCurrency(business.price)}</Text>
            <Text style={styles.priceMeta}>{business.responseTime}</Text>
          </View>
        ) : (
          <View style={styles.priceBanner}>
            <Text style={styles.priceLabel}>Service support</Text>
            <Text style={styles.priceValue}>Customer care</Text>
            <Text style={styles.priceMeta}>Use the support button if you need help with this service.</Text>
          </View>
        )}

        <Text style={styles.description}>{business.longDescription}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Listed by</Text>
            <Text style={styles.statValue}>{business.ownerName}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Category</Text>
            <Text style={styles.statValue}>{business.category}</Text>
          </View>
          {isProduct ? (
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
            {isProduct ? 'What comes with it' : 'Skills and services'}
          </Text>
          <View style={styles.serviceList}>
            {business.services.map((service) => (
              <View key={service} style={styles.servicePill}>
                <Text style={styles.serviceText}>{service}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isProduct ? 'Seller profile' : 'Professional profile'}
          </Text>
          <Pressable
            disabled={!business.ownerUserId}
            onPress={() => {
              if (business.ownerUserId) {
                navigation.navigate('SellerProfile', { userId: business.ownerUserId });
              }
            }}
            style={({ pressed }) => [styles.ownerCard, pressed && business.ownerUserId && styles.ownerCardPressed]}
          >
            <Text style={styles.ownerTitle}>{business.ownerName}</Text>
            <Text style={styles.ownerMeta}>
              {isProduct
                ? `${business.category} seller serving ${business.cluster}, ${estate?.name ?? 'River Park'}`
                : `${business.category} specialist serving ${business.cluster}, ${estate?.name ?? 'River Park'}`}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isProduct ? 'Buy this item' : 'Need help?'}
          </Text>
          <View style={styles.buttonGroup}>
            {isProduct ? (
              <AppButton
                disabled={!isAvailableToPublic || isOutOfStock || isOwnProduct}
                label={
                  !isAvailableToPublic
                    ? 'Unavailable'
                    : isOutOfStock
                      ? 'Out of stock'
                      : isOwnProduct
                        ? 'Your listing'
                        : 'Add to cart'
                }
                onPress={() => addToCart(business.id)}
              />
            ) : (
              <Text style={styles.noticeText}>
                Use the floating customer care button for service questions or support.
              </Text>
            )}
            {business.ownerUserId ? (
              <AppButton
                label="View business profile"
                disabled={!isAvailableToPublic}
                onPress={() =>
                  navigation.navigate('SellerProfile', { userId: business.ownerUserId! })
                }
                variant="ghost"
              />
            ) : null}
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
            {isProduct ? 'More items in River Park' : 'More services in River Park'}
          </Text>
          {relatedBusinesses.map((item) => (
            <View key={item.id} style={styles.relatedRow}>
              <View style={styles.relatedCopy}>
                <Text style={styles.relatedName}>{item.name}</Text>
                <Text style={styles.relatedMeta}>
                  {item.category} - {item.cluster}
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
