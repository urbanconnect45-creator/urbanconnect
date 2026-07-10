import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import {
  acceptDispatchDeliveryJob,
  fetchDispatchDeliveryJobs,
  markDispatchDeliveryArrived,
  markDispatchDeliveryPickedUp,
} from '../services/supabaseApi';
import type { DispatchDeliveryJob } from '../types/business';
import type { AppColors } from '../theme';
import { radii, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatCurrency, formatDateTime } from '../utils/format';

function statusLabel(status: DispatchDeliveryJob['status']) {
  switch (status) {
    case 'available':
      return 'Available';
    case 'accepted':
      return 'Accepted';
    case 'pickedUp':
      return 'Picked up';
    case 'awaitingBuyerConfirmation':
      return 'Awaiting confirmation';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function DispatchDashboardScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { signOut, supabaseAccessToken, user } = useAuth();
  const { getNotificationsForUser, markNotificationsRead } = useBusinessDirectory();
  const dispatchNotifications = getNotificationsForUser(user);
  const unreadDispatchNotificationCount = dispatchNotifications.filter(
    (notification) => !notification.readAt,
  ).length;
  const [jobs, setJobs] = useState<DispatchDeliveryJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  const loadJobs = async () => {
    if (!supabaseAccessToken) {
      setJobs([]);
      setError('Sign in again to load the dispatch queue.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const nextJobs = await fetchDispatchDeliveryJobs(supabaseAccessToken);
      setJobs(nextJobs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the dispatch queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, [supabaseAccessToken]);

  const runJobAction = async (
    job: DispatchDeliveryJob,
    action: 'accept' | 'pickedUp' | 'arrived',
  ) => {
    if (!supabaseAccessToken) {
      setError('Sign in again to update delivery jobs.');
      return;
    }

    try {
      setActionJobId(job.id);
      setError(null);

      const nextStatus =
        action === 'accept' ? 'Accepted' : action === 'pickedUp' ? 'Picked up' : 'Awaiting confirmation';

      if (action === 'accept') {
        await acceptDispatchDeliveryJob(supabaseAccessToken, job.id);
      } else if (action === 'pickedUp') {
        await markDispatchDeliveryPickedUp(supabaseAccessToken, job.id);
      } else {
        await markDispatchDeliveryArrived(supabaseAccessToken, job.id);
      }

      await loadJobs();
      Alert.alert('Delivery updated', `${job.sellerName} was moved to ${nextStatus.toLowerCase()}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the job.');
    } finally {
      setActionJobId(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Dispatch dashboard</Text>
          <Text style={styles.title}>{user.fullName}</Text>
          <Text style={styles.body}>
            Assigned and available delivery jobs appear here. Accept a job, mark it picked up,
            then confirm arrival at the buyer address.
          </Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.metricValue}>{jobs.length}</Text>
          <Text style={styles.metricLabel}>Jobs loaded</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <AppButton label={isLoading ? 'Refreshing...' : 'Refresh queue'} loading={isLoading} onPress={() => void loadJobs()} />
        <AppButton label="Sign out" onPress={signOut} variant="ghost" />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons color={colors.danger} name="alert-circle-outline" size={20} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleCopy}>
            <Text style={styles.cardTitle}>Dispatch notifications</Text>
            <Text style={styles.cardMeta}>
              {unreadDispatchNotificationCount > 0
                ? `${unreadDispatchNotificationCount} unread alert${unreadDispatchNotificationCount > 1 ? 's' : ''}`
                : 'Delivery alerts and job updates appear here.'}
            </Text>
          </View>
          {dispatchNotifications.length > 0 ? (
            <AppButton
              label="Mark read"
              onPress={() => markNotificationsRead(user.id)}
              variant="ghost"
            />
          ) : null}
        </View>
        {dispatchNotifications.length > 0 ? (
          dispatchNotifications.slice(0, 3).map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View style={styles.cardTitleCopy}>
                <Text style={styles.cardTitle}>{notification.title}</Text>
                <Text style={styles.cardBody}>{notification.body}</Text>
                <Text style={styles.cardMeta}>{formatDateTime(notification.createdAt)}</Text>
              </View>
              {!notification.readAt ? (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>New</Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.body}>No dispatch notifications yet.</Text>
        )}
      </View>

      <View style={styles.list}>
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <View key={job.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleCopy}>
                  <Text style={styles.cardTitle}>{job.sellerName}</Text>
                  <Text style={styles.cardMeta}>{job.orderId}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{statusLabel(job.status)}</Text>
                </View>
              </View>

              <View style={styles.addressRow}>
                <View style={styles.addressBlock}>
                  <Text style={styles.cardLabel}>Pickup</Text>
                  <Text style={styles.cardBody}>{job.pickupAddress}</Text>
                </View>
                <View style={styles.addressBlock}>
                  <Text style={styles.cardLabel}>Drop-off</Text>
                  <Text style={styles.cardBody}>{job.deliveryAddress}</Text>
                </View>
              </View>

              <View style={styles.cardGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.cardLabel}>Item subtotal</Text>
                  <Text style={styles.metricValueSmall}>{formatCurrency(job.itemSubtotal)}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.cardLabel}>Delivery fee</Text>
                  <Text style={styles.metricValueSmall}>{formatCurrency(job.deliveryFee)}</Text>
                </View>
              </View>

              <Text style={styles.cardMeta}>Created {formatDateTime(job.createdAt)}</Text>
              <View style={styles.actionRow}>
                {job.status === 'available' ? (
                  <AppButton
                    label={actionJobId === job.id ? 'Accepting...' : 'Accept job'}
                    loading={actionJobId === job.id}
                    onPress={() => void runJobAction(job, 'accept')}
                  />
                ) : null}
                {job.status === 'accepted' ? (
                  <AppButton
                    label={actionJobId === job.id ? 'Updating...' : 'Mark picked up'}
                    loading={actionJobId === job.id}
                    onPress={() => void runJobAction(job, 'pickedUp')}
                    variant="secondary"
                  />
                ) : null}
                {job.status === 'pickedUp' ? (
                  <AppButton
                    label={actionJobId === job.id ? 'Updating...' : 'Mark arrived'}
                    loading={actionJobId === job.id}
                    onPress={() => void runJobAction(job, 'arrived')}
                    variant="secondary"
                  />
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1580674284084-8c3a3f3d8f8d?auto=format&fit=crop&w=900&q=80' }}
              style={styles.emptyImage}
            />
            <Text style={styles.cardTitle}>No delivery jobs yet</Text>
            <Text style={styles.body}>
              When paid orders create delivery work, the queue appears here automatically.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    page: {
      gap: spacing.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    heroCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: colors.secondary,
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    body: {
      ...typography.body,
      color: colors.textMuted,
    },
    heroMetric: {
      minWidth: 140,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      padding: spacing.lg,
    },
    metricValue: {
      ...typography.title,
      color: colors.primary,
    },
    metricValueSmall: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    metricLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    list: {
      gap: spacing.md,
    },
    card: {
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    cardTitleCopy: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    cardMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    cardLabel: {
      ...typography.caption,
      color: colors.secondary,
      fontWeight: '800',
    },
    cardBody: {
      ...typography.body,
      color: colors.text,
    },
    statusPill: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    statusText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    addressRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    addressBlock: {
      flex: 1,
      minWidth: 220,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metricCard: {
      flex: 1,
      minWidth: 160,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    emptyState: {
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    emptyImage: {
      width: '100%',
      height: 160,
      borderRadius: radii.lg,
    },
  });
}
