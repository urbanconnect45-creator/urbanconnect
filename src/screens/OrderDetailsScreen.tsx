import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { OrderDetailsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatCurrency, formatDateTime } from '../utils/format';
import {
  getOrderProgress,
  getOrderStageLabels,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../utils/order';

export function OrderDetailsScreen({ navigation, route }: OrderDetailsScreenProps) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { getBusinessById, getOrderById } = useBusinessDirectory();
  const order = getOrderById(route.params.orderId);

  if (!order) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>Order not found</Text>
        <Text style={styles.emptyText}>
          This order may have been removed from local history or not created yet.
        </Text>
        <AppButton label="Back" onPress={() => navigation.goBack()} variant="secondary" />
      </View>
    );
  }

  const stageLabels = getOrderStageLabels();
  const completedStages =
    order.status === 'cancelled'
      ? 0
      : Math.round(getOrderProgress(order.status) * stageLabels.length);
  const canSeeDeliveryAddress = user?.role !== 'businessOwner' || user.id === order.userId;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Order tracking</Text>
        <Text style={styles.title}>{order.id}</Text>
        <Text style={styles.subtitle}>
          Track payment confirmation, pickup, delivery, and items in one place.
        </Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>Status</Text>
            <Text style={styles.heroBadgeValue}>{getOrderStatusLabel(order.status)}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>Payment</Text>
            <Text style={styles.heroBadgeValue}>
              {getPaymentStatusLabel(order.paymentStatus)}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>Total</Text>
            <Text style={styles.heroBadgeValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery progress</Text>
        <View style={styles.progressTrack}>
          {stageLabels.map((label, index) => {
            const isComplete = completedStages > index;
            const isFinal = index === stageLabels.length - 1;

            return (
              <View key={label} style={styles.progressStep}>
                <View style={[styles.progressDot, isComplete && styles.progressDotActive]}>
                  {isComplete ? (
                    <Ionicons color={colors.white} name="checkmark" size={12} />
                  ) : null}
                </View>
                {!isFinal ? (
                  <View
                    style={[
                      styles.progressLine,
                      completedStages > index + 1 && styles.progressLineActive,
                    ]}
                  />
                ) : null}
                <Text style={[styles.progressLabel, isComplete && styles.progressLabelActive]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
        {order.status === 'cancelled' ? (
          <Text style={styles.noticeText}>
            This order was cancelled before completion. No further delivery steps are active.
          </Text>
        ) : null}
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Placed on</Text>
          <Text style={styles.infoValue}>{formatDateTime(order.createdAt)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Expected delivery</Text>
          <Text style={styles.infoValue}>
            {order.expectedDeliveryAt ? formatDateTime(order.expectedDeliveryAt) : 'Pending'}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Payment method</Text>
          <Text style={styles.infoValue}>{getPaymentMethodLabel(order.paymentMethod)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Delivery cluster</Text>
          <Text style={styles.infoValue}>{order.deliveryCluster}</Text>
        </View>
      </View>

      {canSeeDeliveryAddress ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          <Text style={styles.bodyText}>{order.deliveryAddress}</Text>
          {order.note ? (
            <>
              <Text style={styles.sectionSubtitle}>Customer note</Text>
              <Text style={styles.bodyText}>{order.note}</Text>
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <Text style={styles.bodyText}>
            Customer care manages the buyer address from the admin order record.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items in this order</Text>
        <View style={styles.stack}>
          {order.items.map((item, index) => {
            const business = getBusinessById(item.businessId);

            return (
              <View key={`${order.id}-${item.businessId}-${index}`} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{item.businessName}</Text>
                    <Text style={styles.itemMeta}>{item.ownerName}</Text>
                  </View>
                  <Text style={styles.itemValue}>{formatCurrency(item.lineTotal)}</Text>
                </View>
                <Text style={styles.itemMeta}>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </Text>
                {business ? (
                  <Pressable
                    onPress={() => navigation.navigate('BusinessDetails', { businessId: business.id })}
                    style={({ pressed }) => [styles.inlineLink, pressed && styles.inlineLinkPressed]}
                  >
                    <Text style={styles.inlineLinkText}>Open listing</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment summary</Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(order.subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Delivery charge</Text>
          <Text style={styles.totalValue}>
            {order.deliveryFee === 0 ? 'Free' : formatCurrency(order.deliveryFee)}
          </Text>
        </View>
        <View style={[styles.totalRow, styles.totalRowStrong]}>
          <Text style={styles.totalLabelStrong}>
            {order.paymentStatus === 'paid' ? 'Total paid' : 'Order total'}
          </Text>
          <Text style={styles.totalValueStrong}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.stack}>
          {order.timeline
            .slice()
            .reverse()
            .map((event) => (
              <View key={event.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineCopy}>
                  <Text style={styles.timelineTitle}>{event.label}</Text>
                  <Text style={styles.timelineMeta}>{event.note}</Text>
                  <Text style={styles.timelineMeta}>{formatDateTime(event.createdAt)}</Text>
                </View>
              </View>
            ))}
        </View>
      </View>

      <View style={styles.actionStack}>
        <AppButton label="Back" onPress={() => navigation.goBack()} variant="secondary" />
        <AppButton
          label="Open account"
          onPress={() => navigation.navigate('Account')}
          variant="ghost"
        />
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
    hero: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: '#111111',
      padding: spacing.xl,
      ...shadows.card,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#B9B9B9',
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    subtitle: {
      ...typography.body,
      color: '#D9D9D9',
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    heroBadge: {
      minWidth: 132,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: '#1F1F1F',
      padding: spacing.md,
    },
    heroBadgeLabel: {
      ...typography.caption,
      color: '#B9B9B9',
    },
    heroBadgeValue: {
      ...typography.bodyStrong,
      color: colors.white,
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
    sectionSubtitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    progressTrack: {
      gap: spacing.md,
    },
    progressStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressDot: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 22,
      width: 22,
      borderRadius: 11,
      backgroundColor: '#D8D8D8',
    },
    progressDotActive: {
      backgroundColor: '#111111',
    },
    progressLine: {
      flex: 1,
      height: 2,
      backgroundColor: '#D8D8D8',
      maxWidth: 80,
    },
    progressLineActive: {
      backgroundColor: '#111111',
    },
    progressLabel: {
      ...typography.caption,
      color: colors.textMuted,
      minWidth: 110,
    },
    progressLabelActive: {
      color: colors.text,
    },
    noticeText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    infoCard: {
      flex: 1,
      minWidth: 160,
      gap: 4,
      borderRadius: radii.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    infoLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    infoValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    stack: {
      gap: spacing.sm,
    },
    itemCard: {
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    itemTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    itemCopy: {
      flex: 1,
      gap: 4,
    },
    itemTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    itemMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    itemValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    inlineLink: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
    },
    inlineLinkPressed: {
      opacity: 0.82,
    },
    inlineLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    totalRowStrong: {
      backgroundColor: colors.primarySoft,
    },
    totalLabel: {
      ...typography.body,
      color: colors.textMuted,
    },
    totalValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    totalLabelStrong: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    totalValueStrong: {
      ...typography.subtitle,
      color: colors.primary,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    timelineDot: {
      marginTop: 6,
      height: 10,
      width: 10,
      borderRadius: 5,
      backgroundColor: '#111111',
    },
    timelineCopy: {
      flex: 1,
      gap: 4,
    },
    timelineTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    timelineMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    actionStack: {
      gap: spacing.sm,
    },
    emptyShell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
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
