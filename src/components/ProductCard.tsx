import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Business } from '../types/business';
import { formatCurrency } from '../utils/format';

type ProductCardProps = {
  business: Business;
  addDisabled?: boolean;
  addLabel?: string;
  onAddToCart?: () => void;
  onPress?: () => void;
  onProfilePress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ProductCard({
  addDisabled = false,
  addLabel = 'Add',
  business,
  onAddToCart,
  onPress,
  onProfilePress,
  style,
}: ProductCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isGoldListing =
    (business.subscriptionStatus === 'paid' || business.subscriptionStatus === 'active') &&
    (!business.subscriptionNextBillingAt ||
      new Date(business.subscriptionNextBillingAt).getTime() > Date.now()) &&
    Boolean(business.riverParkVerified);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isGoldListing && styles.goldCard,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <Image resizeMode="cover" source={{ uri: business.imageUrl }} style={styles.image} />

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{business.cluster}</Text>
        </View>
        <View style={[styles.badge, styles.categoryBadge]}>
          <Text style={styles.badgeText}>{business.category}</Text>
        </View>
        {isGoldListing ? (
          <View style={[styles.badge, styles.goldBadge]}>
            <Text style={styles.goldBadgeText}>Gold</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>
          {business.name}
        </Text>
        <Text numberOfLines={3} style={styles.bio}>
          {business.description}
        </Text>
        <Text style={styles.price}>{formatCurrency(business.price)}</Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onProfilePress?.();
          }}
          style={({ pressed }) => [styles.profileChip, pressed && styles.profileChipPressed]}
        >
          <Image resizeMode="cover" source={{ uri: business.imageUrl }} style={styles.avatar} />
          <Text numberOfLines={1} style={styles.profileText}>
            {business.ownerName}
          </Text>
        </Pressable>

        <Pressable
          disabled={addDisabled}
          onPress={(event) => {
            event.stopPropagation();
            onAddToCart?.();
          }}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && !addDisabled && styles.actionButtonPressed,
            addDisabled && styles.actionButtonDisabled,
          ]}
        >
          <Text style={styles.actionText}>{addLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    goldCard: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    cardPressed: {
      opacity: 0.96,
      transform: [{ translateY: 1 }],
    },
    image: {
      height: 146,
      width: '100%',
    },
    badgeRow: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      right: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    badge: {
      borderRadius: radii.pill,
      backgroundColor: 'rgba(15, 44, 53, 0.76)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    categoryBadge: {
      backgroundColor: 'rgba(240, 132, 92, 0.88)',
    },
    goldBadge: {
      backgroundColor: colors.accent,
    },
    badgeText: {
      ...typography.caption,
      color: colors.white,
    },
    goldBadgeText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    content: {
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    title: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    bio: {
      ...typography.caption,
      color: colors.textMuted,
      minHeight: 48,
    },
    price: {
      ...typography.subtitle,
      color: colors.primary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      padding: spacing.md,
      paddingTop: spacing.sm,
    },
    profileChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: 0,
    },
    profileChipPressed: {
      opacity: 0.88,
    },
    avatar: {
      height: 34,
      width: 34,
      borderRadius: 17,
    },
    profileText: {
      ...typography.caption,
      color: colors.text,
      flex: 1,
    },
    actionButton: {
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    actionButtonPressed: {
      opacity: 0.92,
    },
    actionButtonDisabled: {
      opacity: 0.55,
    },
    actionText: {
      ...typography.caption,
      color: colors.white,
    },
  });
}
