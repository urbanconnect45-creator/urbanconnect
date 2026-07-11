import { Ionicons } from '@expo/vector-icons';
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

type AdvertisementCardProps = {
  advertisement: Business;
  onContactPress?: () => void;
  onMessagePress?: () => void;
  onPress?: () => void;
  onProfilePress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function AdvertisementCard({
  advertisement,
  onContactPress,
  onMessagePress,
  onPress,
  onProfilePress,
  style,
}: AdvertisementCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isPriced = advertisement.listingType === 'product' && advertisement.price > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      <Image resizeMode="cover" source={{ uri: advertisement.imageUrl }} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text numberOfLines={1} style={styles.badgeText}>
              {advertisement.category}
            </Text>
          </View>
          <View style={[styles.badge, styles.adBadge]}>
            <Text style={styles.adBadgeText}>Advertisement</Text>
          </View>
        </View>

        <Text numberOfLines={2} style={styles.title}>
          {advertisement.name}
        </Text>
        <Text numberOfLines={2} style={styles.description}>
          {advertisement.description}
        </Text>
        <Text style={styles.price}>
          {isPriced ? formatCurrency(advertisement.price) : 'Contact advertiser'}
        </Text>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onProfilePress?.();
          }}
          style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
        >
          <Ionicons color={colors.textMuted} name="person-circle-outline" size={17} />
          <Text numberOfLines={1} style={styles.metaText}>
            {advertisement.ownerName}
          </Text>
        </Pressable>
        <View style={styles.metaRow}>
          <Ionicons color={colors.textMuted} name="location-outline" size={17} />
          <Text numberOfLines={1} style={styles.metaText}>
            {advertisement.address || advertisement.cluster}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onMessagePress?.();
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
        >
          <Ionicons color={colors.white} name="chatbubble-ellipses-outline" size={16} />
          <Text style={styles.primaryText}>Message</Text>
        </Pressable>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onContactPress?.();
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Ionicons color={colors.primary} name="call-outline" size={16} />
          <Text style={styles.secondaryText}>Contact</Text>
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
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.soft,
    },
    cardPressed: {
      opacity: 0.96,
      transform: [{ translateY: 1 }],
    },
    image: {
      width: '100%',
      height: 142,
      backgroundColor: colors.card,
    },
    body: {
      gap: spacing.xs,
      padding: spacing.md,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    badge: {
      maxWidth: '100%',
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    adBadge: {
      backgroundColor: colors.accentSoft,
    },
    badgeText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    adBadgeText: {
      ...typography.caption,
      color: colors.accent,
      fontWeight: '800',
    },
    title: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    description: {
      ...typography.caption,
      minHeight: 34,
      color: colors.textMuted,
    },
    price: {
      ...typography.subtitle,
      color: colors.primary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: 0,
    },
    metaRowPressed: {
      opacity: 0.85,
    },
    metaText: {
      ...typography.caption,
      color: colors.textMuted,
      flex: 1,
      minWidth: 0,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      paddingTop: 0,
    },
    primaryButton: {
      flex: 1,
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.sm,
    },
    buttonPressed: {
      opacity: 0.9,
    },
    primaryText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    secondaryText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
  });
}
