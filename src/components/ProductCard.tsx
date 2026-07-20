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
import { normalizeProductCategory } from '../utils/category';
import { formatCurrency } from '../utils/format';

type ProductCardProps = {
  business: Business;
  addDisabled?: boolean;
  addLabel?: string;
  maxQuantity?: number;
  onAddToCart?: () => void;
  onDecreaseQuantity?: () => void;
  onIncreaseQuantity?: () => void;
  onPress?: () => void;
  onProfilePress?: () => void;
  quantity?: number;
  showQuantityControls?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ProductCard({
  addDisabled = false,
  addLabel = 'Add',
  business,
  maxQuantity,
  onAddToCart,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onPress,
  quantity = 0,
  showQuantityControls = false,
  style,
}: ProductCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const displayCategory = normalizeProductCategory(
    business.category,
    business.name,
    business.description,
    business.longDescription,
  );
  const plusDisabled = addDisabled || (maxQuantity !== undefined && quantity >= maxQuantity);
  const minusDisabled = addDisabled || quantity <= 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <Image resizeMode="contain" source={{ uri: business.imageUrl }} style={styles.image} />

      <View style={styles.badgeRow}>
        <View style={[styles.badge, styles.categoryBadge]}>
          <Text style={styles.badgeText}>{displayCategory}</Text>
        </View>
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
        {showQuantityControls ? (
          <View style={[styles.quantityControl, addDisabled && styles.actionButtonDisabled]}>
            <Pressable
              disabled={minusDisabled}
              onPress={(event) => {
                event.stopPropagation();
                onDecreaseQuantity?.();
              }}
              style={({ pressed }) => [
                styles.quantityButton,
                pressed && !minusDisabled && styles.quantityButtonPressed,
                minusDisabled && styles.quantityButtonDisabled,
              ]}
            >
              <Text style={styles.quantitySymbol}>-</Text>
            </Pressable>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <Pressable
              disabled={plusDisabled}
              onPress={(event) => {
                event.stopPropagation();
                onIncreaseQuantity?.();
              }}
              style={({ pressed }) => [
                styles.quantityButton,
                pressed && !plusDisabled && styles.quantityButtonPressed,
                plusDisabled && styles.quantityButtonDisabled,
              ]}
            >
              <Text style={styles.quantitySymbol}>+</Text>
            </Pressable>
          </View>
        ) : (
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
        )}
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
    cardPressed: {
      opacity: 0.96,
      transform: [{ translateY: 1 }],
    },
    image: {
      height: 160,
      width: '100%',
      backgroundColor: colors.card,
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
    badgeText: {
      ...typography.caption,
      color: colors.white,
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
      justifyContent: 'flex-end',
      gap: spacing.sm,
      padding: spacing.md,
      paddingTop: spacing.sm,
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
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    quantityButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      width: 38,
      backgroundColor: colors.primarySoft,
    },
    quantityButtonPressed: {
      opacity: 0.88,
    },
    quantityButtonDisabled: {
      opacity: 0.42,
    },
    quantitySymbol: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    quantityValue: {
      minWidth: 38,
      textAlign: 'center',
      ...typography.bodyStrong,
      color: colors.text,
    },
  });
}
