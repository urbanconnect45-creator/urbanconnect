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
import { formatDateTime } from '../utils/format';

type BusinessCardProps = {
  business: Business;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BusinessCard({
  business,
  compact = false,
  onPress,
  style,
}: BusinessCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const displayTags = business.tags.slice(0, compact ? 2 : 4);

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compactCard,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.imageShell}>
        <Image resizeMode="cover" source={{ uri: business.imageUrl }} style={styles.image} />
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.categoryBadge]}>
            <Text style={styles.categoryText}>{business.category}</Text>
          </View>
          <View style={styles.badgeGroup}>
            <View style={[styles.badge, styles.clusterBadge]}>
              <Text style={styles.clusterBadgeText}>{business.cluster}</Text>
            </View>
            {business.verified ? (
              <View style={[styles.badge, styles.verifiedBadge]}>
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{business.name}</Text>
            <Text style={styles.owner}>by {business.ownerName}</Text>
          </View>
          {business.verified ? (
            <Ionicons color={colors.primary} name="checkmark-circle" size={22} />
          ) : null}
        </View>

        <Text numberOfLines={compact ? 2 : 3} style={styles.description}>
          {business.description}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons color={colors.textMuted} name="location-outline" size={14} />
            <Text numberOfLines={1} style={styles.metaText}>
              {business.address}
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons color={colors.textMuted} name="flash-outline" size={14} />
            <Text style={styles.metaText}>{business.responseTime}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons color={colors.textMuted} name="layers-outline" size={14} />
            <Text style={styles.metaText}>{business.cluster}</Text>
          </View>
        </View>

        <Text style={styles.createdMeta}>Listed {formatDateTime(business.createdAt)}</Text>

        <View style={styles.tagsRow}>
          {displayTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
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
    compactCard: {
      minHeight: 468,
    },
    pressed: {
      transform: [{ translateY: 1 }],
      opacity: 0.97,
    },
    imageShell: {
      position: 'relative',
      height: 224,
    },
    image: {
      height: '100%',
      width: '100%',
    },
    badgeRow: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    badgeGroup: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    badge: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    categoryBadge: {
      backgroundColor: 'rgba(15, 44, 53, 0.8)',
    },
    verifiedBadge: {
      backgroundColor: colors.primarySoft,
    },
    clusterBadge: {
      backgroundColor: colors.secondarySoft,
    },
    categoryText: {
      ...typography.caption,
      color: colors.white,
    },
    clusterBadgeText: {
      ...typography.caption,
      color: colors.text,
    },
    verifiedBadgeText: {
      ...typography.caption,
      color: colors.primary,
    },
    content: {
      gap: spacing.md,
      padding: spacing.lg,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    titleBlock: {
      flex: 1,
      gap: 4,
    },
    title: {
      ...typography.section,
      color: colors.text,
    },
    owner: {
      ...typography.caption,
      color: colors.textMuted,
    },
    description: {
      ...typography.body,
      color: colors.textMuted,
    },
    metaRow: {
      gap: spacing.sm,
    },
    metaPill: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaText: {
      ...typography.caption,
      color: colors.text,
      flex: 1,
    },
    createdMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    tag: {
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    tagText: {
      ...typography.caption,
      color: colors.text,
    },
  });
}
