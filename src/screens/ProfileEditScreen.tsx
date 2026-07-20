import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import { MediaPickerField } from '../components/MediaPickerField';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Business, OwnerBusinessProfile, OwnerBusinessProfileValues } from '../types/business';

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
    coverImage: savedProfile?.coverImage ?? profile?.imageUrl ?? '',
    galleryImages: '',
    galleryVideos: '',
  };
}

export function ProfileEditScreen({ navigation }: MainTabsScreenProps<'ProfileEdit'>) {
  const { user } = useAuth();
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
    () => getOwnerBusinessProfile(user),
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

  useEffect(() => {
    if (!user) {
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
        'Allow gallery access in your device settings so you can update business profile photos.',
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

  const saveBusinessProfile = () => {
    updateOwnerBusinessProfile(
      user,
      profileForm,
      user.fullName,
      isBusinessOwner ? 'businessOwner' : 'system',
    );
    Alert.alert('Profile updated', 'Profile contact details and social links have been saved.', [
      { text: 'View profile', onPress: () => navigation.navigate('Account') },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Edit profile</Text>
        <Text style={styles.title}>
          {isBusinessOwner ? 'Update your store profile.' : 'Update your profile contact.'}
        </Text>
        <Text style={styles.subtitle}>
          Phone, WhatsApp, and social links saved here are used when buyers tap Contact.
        </Text>
      </View>

      <View style={styles.card}>
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
        <FormField
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
        </View>
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
        <AppButton label="Save profile" onPress={saveBusinessProfile} />
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
  });
}
