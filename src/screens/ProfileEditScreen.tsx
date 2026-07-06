import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    phone: savedProfile?.phone ?? profile?.contact.phone ?? phone,
    whatsapp: savedProfile?.whatsapp ?? profile?.contact.whatsapp ?? '',
    email: savedProfile?.email ?? profile?.contact.email ?? email,
    website: '',
    instagram: '',
    address: savedProfile?.address ?? profile?.address ?? address,
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

  if (!user || user.role !== 'businessOwner') {
    return (
      <View style={styles.gateShell}>
        <Text style={styles.sectionTitle}>Business profile only</Text>
        <Text style={styles.bodyText}>Only business owner accounts can edit business details.</Text>
        <AppButton label="Back to profile" onPress={() => navigation.navigate('Account')} />
      </View>
    );
  }

  const updateProfileField = <K extends keyof OwnerBusinessProfileValues>(
    key: K,
    value: OwnerBusinessProfileValues[K],
  ) => {
    setProfileForm((current) => ({ ...current, [key]: value }));
  };

  const coverAssets = profileForm.coverImage
    ? [{ label: assetLabelFromUri(profileForm.coverImage, 'Cover image', 0), uri: profileForm.coverImage }]
    : [];

  const pickCoverImage = async () => {
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

    updateProfileField('coverImage', result.assets[0]?.uri ?? '');
  };

  const saveBusinessProfile = () => {
    updateOwnerBusinessProfile(user, profileForm);
    Alert.alert('Profile updated', 'Business contact details and cover image have been saved.', [
      { text: 'View profile', onPress: () => navigation.navigate('Account') },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Edit profile</Text>
        <Text style={styles.title}>Update your store profile.</Text>
        <Text style={styles.subtitle}>
          Keep your business contact, pickup address, and cover image current.
        </Text>
      </View>

      <View style={styles.card}>
        <FormField
          label="Business contact name"
          onChangeText={(value) => updateProfileField('ownerName', value)}
          placeholder="Ada Nwosu"
          value={profileForm.ownerName}
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
          placeholder="Enter your complete business address"
          value={profileForm.address}
        />
        <MediaPickerField
          assets={coverAssets}
          buttonLabel="Add cover photo"
          helper="Main image on your business profile."
          kind="image"
          label="Cover photo"
          onClear={() => updateProfileField('coverImage', '')}
          onPick={() => {
            void pickCoverImage();
          }}
        />
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
