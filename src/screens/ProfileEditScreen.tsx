import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import { MediaPickerField } from '../components/MediaPickerField';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import {
  fetchDispatchRiderProfile,
  isSupabaseConfigured,
  updateDispatchRiderProfile,
  uploadMediaUriToSupabaseStorage,
} from '../services/supabaseApi';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type {
  Business,
  DispatchRiderProfile,
  OwnerBusinessProfile,
  OwnerBusinessProfileValues,
} from '../types/business';

const openDayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function assetLabelFromUri(uri: string, fallbackPrefix: string, index: number) {
  const lastSegment = uri.split('/').pop()?.split('?')[0];
  return lastSegment && lastSegment.length > 0 ? lastSegment : `${fallbackPrefix} ${index + 1}`;
}

function createProfileForm(
  ownerName: string,
  phone: string,
  email: string,
  address: string,
  profile?: Business | null,
  savedProfile?: OwnerBusinessProfile | null,
): OwnerBusinessProfileValues {
  return {
    ownerName: savedProfile?.ownerName ?? ownerName,
    bio: savedProfile?.bio ?? '',
    profileImage: savedProfile?.profileImage ?? '',
    phone: savedProfile?.phone ?? profile?.contact.phone ?? phone,
    whatsapp: savedProfile?.whatsapp ?? profile?.contact.whatsapp ?? '',
    email: savedProfile?.email ?? profile?.contact.email ?? email,
    website: savedProfile?.website ?? profile?.contact.website ?? '',
    instagram: savedProfile?.instagram ?? profile?.contact.instagram ?? '',
    facebook: savedProfile?.facebook ?? profile?.contact.facebook ?? '',
    x: savedProfile?.x ?? profile?.contact.x ?? '',
    tiktok: savedProfile?.tiktok ?? profile?.contact.tiktok ?? '',
    address: savedProfile?.address ?? profile?.address ?? address,
    openingTime: savedProfile?.openingTime ?? '',
    closingTime: savedProfile?.closingTime ?? '',
    openDays: savedProfile?.openDays ?? [],
    coverImage: savedProfile?.coverImage ?? '',
    galleryImages: '',
    galleryVideos: '',
  };
}

export function ProfileEditScreen({ navigation }: MainTabsScreenProps<'ProfileEdit'>) {
  const { supabaseAccessToken, user } = useAuth();
  const {
    businesses,
    getOwnerBusinessProfile,
    updateOwnerBusinessProfile,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const ownerListing = useMemo(
    () => businesses.find((business) => business.ownerUserId === user?.id) ?? null,
    [businesses, user?.id],
  );
  const savedOwnerProfile = useMemo(
    () => (user?.role === 'dispatch' ? null : getOwnerBusinessProfile(user)),
    [getOwnerBusinessProfile, user],
  );
  const defaultProfileAddress = user?.businessCluster ?? '';
  const [profileForm, setProfileForm] = useState<OwnerBusinessProfileValues>(
    createProfileForm(
      user?.fullName ?? '',
      user?.phoneNumber ?? '',
      user?.email ?? '',
      defaultProfileAddress,
      ownerListing,
      savedOwnerProfile,
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [dispatchProfile, setDispatchProfile] = useState<DispatchRiderProfile | null>(null);
  const [dispatchProfileError, setDispatchProfileError] = useState<string | null>(null);
  const [isLoadingDispatchProfile, setIsLoadingDispatchProfile] = useState(false);

  useEffect(() => {
    if (user?.role !== 'dispatch') {
      setDispatchProfile(null);
      setDispatchProfileError(null);
      return;
    }
    if (!isSupabaseConfigured || !supabaseAccessToken) {
      return;
    }

    let isCurrent = true;
    setIsLoadingDispatchProfile(true);
    setDispatchProfileError(null);
    void fetchDispatchRiderProfile(supabaseAccessToken)
      .then((profile) => {
        if (isCurrent) {
          setDispatchProfile(profile);
          if (!profile) {
            setDispatchProfileError('Your dispatch rider profile could not be found.');
          }
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setDispatchProfileError(
            error instanceof Error ? error.message : 'Unable to load your dispatch profile.',
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingDispatchProfile(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [supabaseAccessToken, user?.id, user?.role]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (user.role === 'dispatch') {
      setProfileForm((current) => ({
        ...current,
        ownerName: dispatchProfile?.fullName ?? user.fullName,
        bio: dispatchProfile?.bio ?? '',
        profileImage: dispatchProfile?.profileImage ?? '',
        phone: dispatchProfile?.phoneNumber ?? user.phoneNumber,
        whatsapp: dispatchProfile?.whatsapp ?? '',
        email: dispatchProfile?.email ?? user.email,
        address: dispatchProfile?.address ?? user.businessCluster ?? '',
        website: '',
        instagram: '',
        facebook: '',
        x: '',
        tiktok: '',
        coverImage: '',
      }));
      return;
    }

    setProfileForm(
      createProfileForm(
        user.fullName,
        user.phoneNumber,
        user.email,
        user.businessCluster ?? '',
        ownerListing,
        savedOwnerProfile,
      ),
    );
  }, [
    dispatchProfile?.updatedAt,
    ownerListing?.id,
    savedOwnerProfile?.updatedAt,
    user?.businessCluster,
    user?.email,
    user?.fullName,
    user?.phoneNumber,
  ]);

  if (!user) {
    return (
      <View style={styles.gateShell}>
        <Text style={styles.sectionTitle}>Sign in required</Text>
        <Text style={styles.bodyText}>Sign in before editing your profile contact details.</Text>
      </View>
    );
  }

  const isBusinessOwner = user.role === 'businessOwner';
  const isDispatchUser = user.role === 'dispatch';

  const updateProfileField = <K extends keyof OwnerBusinessProfileValues>(
    key: K,
    value: OwnerBusinessProfileValues[K],
  ) => {
    setProfileForm((current) => ({ ...current, [key]: value }));
  };

  const coverAssets = profileForm.coverImage
    ? [{ label: assetLabelFromUri(profileForm.coverImage, 'Cover image', 0), uri: profileForm.coverImage }]
    : [];
  const profileImageAssets = profileForm.profileImage
    ? [{ label: assetLabelFromUri(profileForm.profileImage, 'Profile picture', 0), uri: profileForm.profileImage }]
    : [];
  const toggleOpenDay = (day: string) => {
    setProfileForm((current) => {
      const currentDays = current.openDays ?? [];
      const nextDays = currentDays.includes(day)
        ? currentDays.filter((item) => item !== day)
        : [...currentDays, day];

      return { ...current, openDays: nextDays };
    });
  };

  const pickProfileImage = async (field: 'profileImage' | 'coverImage') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow gallery access in your device settings so you can update your profile picture.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });

    if (result.canceled) {
      return;
    }

    updateProfileField(field, result.assets[0]?.uri ?? '');
  };

  const persistProfileImage = async (uri: string, label: string) => {
    const trimmedUri = uri.trim();
    if (!trimmedUri || !isSupabaseConfigured || /^https?:\/\//i.test(trimmedUri)) {
      return trimmedUri;
    }

    return uploadMediaUriToSupabaseStorage(
      trimmedUri,
      ['profile-media', user.id, `${label}-${Date.now()}`].join('/'),
      'image',
    );
  };

  const saveProfile = async () => {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      const savedForm: OwnerBusinessProfileValues = {
        ...profileForm,
        profileImage: await persistProfileImage(profileForm.profileImage, 'avatar'),
        coverImage: isBusinessOwner
          ? await persistProfileImage(profileForm.coverImage, 'cover')
          : '',
      };
      if (isDispatchUser) {
        if (!supabaseAccessToken) {
          throw new Error('Your dispatch session has expired. Sign in again and retry.');
        }
        const savedDispatchProfile = await updateDispatchRiderProfile(supabaseAccessToken, {
          fullName: savedForm.ownerName,
          email: savedForm.email,
          phoneNumber: savedForm.phone,
          whatsapp: savedForm.whatsapp,
          address: savedForm.address,
          profileImage: savedForm.profileImage,
          bio: savedForm.bio,
        });
        setDispatchProfile(savedDispatchProfile);
        setDispatchProfileError(null);
        setProfileForm(savedForm);
        Alert.alert('Profile updated', 'Your dispatch profile has been saved.', [
          { text: 'View profile', onPress: () => navigation.navigate('Account') },
        ]);
        return;
      }
      await updateOwnerBusinessProfile(
        user,
        savedForm,
        user.fullName,
        isBusinessOwner ? 'businessOwner' : 'system',
      );
      setProfileForm(savedForm);
      Alert.alert('Profile updated', 'Profile contact details and social links have been saved.', [
        { text: 'View profile', onPress: () => navigation.navigate('Account') },
      ]);
    } catch (error) {
      Alert.alert(
        'Profile not saved',
        error instanceof Error ? error.message : 'Unable to save your profile right now.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Edit profile</Text>
        <Text style={styles.title}>
          {isBusinessOwner
            ? 'Update your store profile.'
            : isDispatchUser
              ? 'Update your dispatch profile.'
              : 'Update your profile contact.'}
        </Text>
        <Text style={styles.subtitle}>
          {isDispatchUser
            ? 'Keep your delivery contact details accurate for active orders.'
            : 'Phone, WhatsApp, and social links saved here are used when buyers tap Contact.'}
        </Text>
      </View>

      <View style={styles.card}>
        {isLoadingDispatchProfile ? (
          <Text style={styles.bodyText}>Loading dispatch profile...</Text>
        ) : null}
        {dispatchProfileError ? <Text style={styles.errorText}>{dispatchProfileError}</Text> : null}
        <FormField
          label={isBusinessOwner ? 'Business contact name' : 'Profile contact name'}
          onChangeText={(value) => updateProfileField('ownerName', value)}
          placeholder="Ada Nwosu"
          value={profileForm.ownerName}
        />
        <FormField
          label="Bio"
          multiline
          onChangeText={(value) => updateProfileField('bio', value)}
          placeholder={
            isBusinessOwner
              ? 'Tell buyers what your store sells and what makes it reliable.'
              : 'Tell buyers a little about you or what you usually advertise.'
          }
          value={profileForm.bio}
        />
        <MediaPickerField
          assets={profileImageAssets}
          buttonLabel="Add profile picture"
          helper="Used only for the small circular avatar on adverts and profile headers."
          kind="image"
          label="Profile picture"
          onClear={() => updateProfileField('profileImage', '')}
          onPick={() => {
            void pickProfileImage('profileImage');
          }}
        />
        <FormField
          keyboardType="phone-pad"
          label="Phone"
          onChangeText={(value) => updateProfileField('phone', value)}
          placeholder="+2348001112233"
          value={profileForm.phone}
        />
        <FormField
          keyboardType="phone-pad"
          label="WhatsApp"
          onChangeText={(value) => updateProfileField('whatsapp', value)}
          placeholder="+2348001112233"
          value={profileForm.whatsapp}
        />
        <FormField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => updateProfileField('email', value)}
          placeholder="business@example.com"
          value={profileForm.email}
        />
        <FormField
          label="Address or pickup point"
          onChangeText={(value) => updateProfileField('address', value)}
          placeholder={isBusinessOwner ? 'Enter your complete business address' : 'Enter your area or meeting location'}
          value={profileForm.address}
        />
        {isBusinessOwner ? (
          <>
            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <FormField
                  label="Opening time"
                  onChangeText={(value) => updateProfileField('openingTime', value)}
                  placeholder="09:00 AM"
                  value={profileForm.openingTime ?? ''}
                />
              </View>
              <View style={styles.inlineField}>
                <FormField
                  label="Closing time"
                  onChangeText={(value) => updateProfileField('closingTime', value)}
                  placeholder="08:00 PM"
                  value={profileForm.closingTime ?? ''}
                />
              </View>
            </View>
            <View style={styles.daySection}>
              <Text style={styles.sectionTitle}>Open days</Text>
              <View style={styles.dayGrid}>
                {openDayOptions.map((day) => {
                  const isSelected = profileForm.openDays?.includes(day);

                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleOpenDay(day)}
                      style={({ pressed }) => [
                        styles.dayChip,
                        isSelected && styles.dayChipActive,
                        pressed && styles.dayChipPressed,
                      ]}
                    >
                      <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
        {!isDispatchUser ? <><FormField
          autoCapitalize="none"
          keyboardType="url"
          label="Website"
          onChangeText={(value) => updateProfileField('website', value)}
          placeholder="https://example.com"
          value={profileForm.website}
        />
        <View style={styles.inlineFieldRow}>
          <View style={styles.inlineField}>
            <FormField
              label="Instagram"
              onChangeText={(value) => updateProfileField('instagram', value)}
              placeholder="@yourhandle"
              value={profileForm.instagram}
            />
          </View>
          <View style={styles.inlineField}>
            <FormField
              label="Facebook"
              onChangeText={(value) => updateProfileField('facebook', value)}
              placeholder="Facebook name"
              value={profileForm.facebook}
            />
          </View>
        </View>
        <View style={styles.inlineFieldRow}>
          <View style={styles.inlineField}>
            <FormField
              label="X / Twitter"
              onChangeText={(value) => updateProfileField('x', value)}
              placeholder="@yourhandle"
              value={profileForm.x}
            />
          </View>
          <View style={styles.inlineField}>
            <FormField
              label="TikTok"
              onChangeText={(value) => updateProfileField('tiktok', value)}
              placeholder="@yourhandle"
              value={profileForm.tiktok}
            />
          </View>
        </View></> : null}
        {isBusinessOwner ? (
          <MediaPickerField
            assets={coverAssets}
            buttonLabel="Add cover photo"
            helper="Used only as the profile or store cover, not as listing media."
            kind="image"
            label="Cover photo"
            onClear={() => updateProfileField('coverImage', '')}
            onPick={() => {
              void pickProfileImage('coverImage');
            }}
          />
        ) : null}
        <AppButton
          disabled={isLoadingDispatchProfile}
          label="Save profile"
          loading={isSaving}
          onPress={() => void saveProfile()}
        />
        <AppButton
          label="Back to profile"
          onPress={() => navigation.navigate('Account')}
          variant="secondary"
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
    gateShell: {
      gap: spacing.md,
      padding: spacing.lg,
    },
    hero: {
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
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
    card: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    inlineFieldRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    inlineField: {
      flex: 1,
      minWidth: 180,
    },
    daySection: {
      gap: spacing.sm,
    },
    dayGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    dayChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    dayChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    dayChipPressed: {
      opacity: 0.88,
    },
    dayChipText: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '700',
    },
    dayChipTextActive: {
      color: colors.white,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    errorText: {
      ...typography.body,
      color: colors.danger,
    },
  });
}
