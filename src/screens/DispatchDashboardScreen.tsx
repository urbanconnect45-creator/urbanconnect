import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import { googleMapsSearchUrl } from '../services/location';
import {
  acceptDispatchDeliveryJob,
  fetchDispatchDeliveryJobs,
  fetchDispatchRiderProfile,
  markDispatchDeliveryArrived,
  markDispatchDeliveryPickedUp,
} from '../services/supabaseApi';
import type { DeliveryLocation, DispatchDeliveryJob, DispatchRiderProfile } from '../types/business';
import type { AppColors } from '../theme';
import { radii, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatDateTime } from '../utils/format';

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

function fallbackDeliveryLocation(job: DispatchDeliveryJob): DeliveryLocation {
  return {
    userId: '',
    formattedAddress: job.deliveryAddress,
    country: '',
    stateOrRegion: '',
    city: '',
    areaOrDistrict: '',
    streetName: '',
    buildingInfo: '',
    landmark: '',
    latitude: null,
    longitude: null,
    additionalInstructions: '',
    source: 'manual',
    updatedAt: job.updatedAt,
  };
}

export function DispatchDashboardScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { signOut, supabaseAccessToken, user } = useAuth();
  const { getNotificationsForUser, markNotificationsRead } = useBusinessDirectory();
  const dispatchNotifications = getNotificationsForUser(user).filter(
    (notification) => notification.audience === 'dispatch' || notification.userId === user?.id,
  );
  const unreadDispatchNotificationCount = dispatchNotifications.filter(
    (notification) => !notification.readAt,
  ).length;
  const [jobs, setJobs] = useState<DispatchDeliveryJob[]>([]);
  const [riderProfile, setRiderProfile] = useState<DispatchRiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  const loadJobs = async () => {
    if (!supabaseAccessToken) {
      setJobs([]);
      setRiderProfile(null);
      setError('Sign in again to load the dispatch queue.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [nextJobs, nextRiderProfile] = await Promise.all([
        fetchDispatchDeliveryJobs(supabaseAccessToken),
        fetchDispatchRiderProfile(supabaseAccessToken).catch(() => null),
      ]);
      setJobs(nextJobs);
      setRiderProfile(nextRiderProfile);
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

    if (action === 'accept' && riderProfile?.status !== 'active') {
      const message =
        'Finish dispatch KYC and wait for admin activation before accepting delivery jobs.';
      setError(message);
      Alert.alert('Dispatch KYC required', message);
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
      const message =
        actionError instanceof Error ? actionError.message : 'Unable to update the job.';
      setError(
        /active rider account required/i.test(message)
          ? 'Finish dispatch KYC and wait for admin activation before accepting delivery jobs.'
          : message,
      );
    } finally {
      setActionJobId(null);
    }
  };

  const openBuyerLocation = async (job: DispatchDeliveryJob) => {
    try {
      await Linking.openURL(googleMapsSearchUrl(job.deliveryLocation ?? fallbackDeliveryLocation(job)));
    } catch {
      setError('Unable to open the buyer location on this device.');
    }
  };

  const callBuyer = async (phoneNumber: string) => {
    try {
      await Linking.openURL(`tel:${phoneNumber.replace(/[^\d+]/g, '')}`);
    } catch {
      setError('Unable to open the phone dialer on this device.');
    }
  };

  if (!user) {
    return null;
  }

  const riderReady = riderProfile?.status === 'active';
  const riderStatusLabel = riderProfile?.status ?? 'pending';
  const activeDispatchJobs = jobs.filter(
    (job) => job.status !== 'completed' && job.status !== 'cancelled',
  );

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
          <Text style={styles.metricValue}>{activeDispatchJobs.length}</Text>
          <Text style={styles.metricLabel}>Active jobs</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <AppButton label={isLoading ? 'Refreshing...' : 'Refresh queue'} loading={isLoading} onPress={() => void loadJobs()} />
        <AppButton label="Sign out" onPress={signOut} variant="ghost" />
      </View>

      <View style={[styles.readinessCard, riderReady && styles.readinessCardReady]}>
        <View
          style={[
            styles.readinessIcon,
            riderReady ? styles.readinessIconReady : styles.readinessIconPending,
          ]}
        >
          <Ionicons
            color={riderReady ? colors.success : colors.warning}
            name={riderReady ? 'checkmark-circle-outline' : 'shield-checkmark-outline'}
            size={22}
          />
        </View>
        <View style={styles.cardTitleCopy}>
          <Text style={styles.cardTitle}>
            {riderReady ? 'Ready for delivery jobs' : 'Finish dispatch KYC'}
          </Text>
          <Text style={styles.cardBody}>
            {riderReady
              ? 'Your rider profile is active. You can accept available jobs and update delivery progress.'
              : 'Complete rider KYC, vehicle details, and admin activation before accepting rides.'}
          </Text>
          <Text style={styles.cardMeta}>
            Status: {riderStatusLabel}
            {riderProfile?.vehicleType ? ` - Vehicle: ${riderProfile.vehicleType}` : ''}
            {riderProfile?.plateNumber ? ` - Plate: ${riderProfile.plateNumber}` : ''}
          </Text>
        </View>
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
        {activeDispatchJobs.length > 0 ? (
          activeDispatchJobs.map((job) => (
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
                  {job.deliveryLocation?.additionalInstructions ? (
                    <Text style={styles.cardMeta}>
                      Note: {job.deliveryLocation.additionalInstructions}
                    </Text>
                  ) : null}
                  {job.deliveryLocation?.latitude != null && job.deliveryLocation?.longitude != null ? (
                    <Text style={styles.cardMeta}>
                      Exact pin saved for dispatch navigation.
                    </Text>
                  ) : null}
                  {job.deliveryContactPhone ? (
                    <Text style={styles.cardMeta}>Call buyer: {job.deliveryContactPhone}</Text>
                  ) : null}
                </View>
              </View>


              <Text style={styles.cardMeta}>Created {formatDateTime(job.createdAt)}</Text>
              <View style={styles.actionRow}>
                <AppButton
                  label="Open buyer location"
                  onPress={() => void openBuyerLocation(job)}
                  variant="ghost"
                />
                {job.deliveryContactPhone ? (
                  <AppButton
                    label="Call buyer"
                    onPress={() => void callBuyer(job.deliveryContactPhone ?? '')}
                    variant="secondary"
                  />
                ) : null}
                {job.status === 'available' ? (
                  <AppButton
                    disabled={!riderReady}
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
            <Text style={styles.cardTitle}>No active delivery jobs yet</Text>
            <Text style={styles.body}>
              New pickup and drop-off jobs will appear here when orders are ready for dispatch.
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
    readinessCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: '#FFF8EA',
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.lg,
    },
    readinessCardReady: {
      backgroundColor: '#EDFDF8',
      borderColor: colors.success,
    },
    readinessIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
    },
    readinessIconPending: {
      backgroundColor: '#FFF3D6',
      borderColor: colors.warning,
    },
    readinessIconReady: {
      backgroundColor: '#E1FAF1',
      borderColor: colors.success,
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
