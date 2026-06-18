import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import { MediaPickerField } from '../components/MediaPickerField';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import {
  productCategories,
  professionCategories,
  riverParkClusters,
  type Business,
  type BusinessProfileFormValues,
  type ListingType,
  type OwnerBusinessProfile,
} from '../types/business';
import { buildBusinessMedia } from '../utils/businessMedia';
import { splitInputList } from '../utils/businessMedia';
import { formatCurrency } from '../utils/format';
import { createRandomListingForm } from '../utils/randomListing';

function categoriesForListingType(listingType: ListingType) {
  return listingType === 'product' ? [...productCategories] : [...professionCategories];
}

function createInitialForm(
  estateId: string,
  ownerName = '',
  email = '',
  phone = '',
  profile?: Business | null,
  savedProfile?: OwnerBusinessProfile | null,
): BusinessProfileFormValues {
  return {
    listingType: 'product',
    businessName: '',
    ownerName: savedProfile?.ownerName ?? ownerName,
    estateId,
    subscriptionCycle: 'monthly',
    cluster: riverParkClusters[0],
    category: productCategories[0],
    shortDescription: '',
    longDescription: '',
    price: '',
    stockQuantity: '12',
    reorderLevel: '5',
    phone: savedProfile?.phone ?? profile?.contact.phone ?? phone,
    whatsapp: savedProfile?.whatsapp ?? profile?.contact.whatsapp ?? '',
    email: savedProfile?.email ?? profile?.contact.email ?? email,
    website: savedProfile?.website ?? profile?.contact.website ?? '',
    instagram: savedProfile?.instagram ?? profile?.contact.instagram ?? '',
    address: savedProfile?.address ?? profile?.address ?? 'River Park Estate',
    coverImage: savedProfile?.coverImage ?? profile?.imageUrl ?? '',
    galleryImages: savedProfile?.galleryImages ?? '',
    galleryVideos: savedProfile?.galleryVideos ?? '',
    services: '',
  };
}

function previewFallbackImage(listingType: ListingType) {
  return listingType === 'product'
    ? 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80'
    : 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=900&q=80';
}

function assetLabelFromUri(uri: string, fallbackPrefix: string, index: number) {
  const lastSegment = uri.split('/').pop()?.split('?')[0];
  return lastSegment && lastSegment.length > 0 ? lastSegment : `${fallbackPrefix} ${index + 1}`;
}

function assetsFromValue(value: string, fallbackPrefix: string) {
  return splitInputList(value).map((uri, index) => ({
    label: assetLabelFromUri(uri, fallbackPrefix, index),
    uri,
  }));
}

function mergeSelectedUris(currentValue: string, nextUris: string[]) {
  return Array.from(new Set([...splitInputList(currentValue), ...nextUris])).join(', ');
}

function createPreviewBusiness(values: BusinessProfileFormValues): Business {
  const fallbackImage = values.coverImage || previewFallbackImage(values.listingType);
  const media = buildBusinessMedia({
    baseId: 'preview',
    coverImage: values.coverImage,
    galleryImages: values.galleryImages,
    galleryVideos: values.galleryVideos,
    fallbackImage,
  });
  const parsedPrice =
    values.listingType === 'product' ? Number.parseFloat(values.price) : 0;
  const parsedStockQuantity = Number.parseInt(values.stockQuantity, 10);
  const parsedReorderLevel = Number.parseInt(values.reorderLevel, 10);

  return {
    id: 'preview',
    estateId: values.estateId,
    listingType: values.listingType,
    name:
      values.businessName ||
      (values.listingType === 'product' ? 'Your item name' : 'Your service profile'),
    ownerName: values.ownerName || 'Owner name',
    cluster: values.cluster,
    category: values.category,
    description:
      values.shortDescription ||
      (values.listingType === 'product'
        ? 'A short summary of the item people can purchase.'
        : 'A short summary of the service people can request.'),
    longDescription:
      values.longDescription ||
      (values.listingType === 'product'
        ? 'Use the detailed description to explain what buyers get, delivery expectations, and why this item stands out in River Park.'
        : 'Use the detailed description to explain your service style, response time, and why residents should trust you.'),
    imageUrl: media[0]?.url ?? fallbackImage,
    media,
    address: values.address || 'River Park service base',
    sku: values.businessName.trim()
      ? `UC-${values.businessName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`
      : 'UC-PREVIEW',
    subscriptionCycle: values.subscriptionCycle,
    subscriptionStatus: 'pending',
    verifiedAmount: 0,
    subscriptionItemCount: 1,
    stockQuantity:
      values.listingType === 'product' && Number.isFinite(parsedStockQuantity)
        ? Math.max(0, parsedStockQuantity)
        : 0,
    reorderLevel:
      values.listingType === 'product' && Number.isFinite(parsedReorderLevel)
        ? Math.max(1, parsedReorderLevel)
        : 0,
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    priceLabel: values.listingType === 'product' ? 'Price' : 'Customer care support',
    responseTime: values.listingType === 'product' ? 'Delivered today' : 'Customer care support',
    verified: false,
    services: Array.from(
      new Set(
        values.services
          .split(',')
          .map((service) => service.trim())
          .filter(Boolean),
      ),
    ).slice(0, 3),
    tags: ['Preview', values.category, values.cluster],
    contact: {
      phone: values.phone || '+2348000000000',
      email: values.email || 'owner@example.com',
      ...(values.whatsapp ? { whatsapp: values.whatsapp } : {}),
      ...(values.website ? { website: values.website } : {}),
      ...(values.instagram ? { instagram: values.instagram } : {}),
    },
    createdAt: new Date().toISOString(),
  };
}

export function RegisterBusinessScreen({ navigation }: MainTabsScreenProps<'RegisterBusiness'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    businesses,
    currentEstateId,
    estates,
    getOwnerBusinessProfile,
    isRiverParkVerifiedForUser,
    registerBusiness,
  } = useBusinessDirectory();
  const currentEstate = estates.find((estate) => estate.id === currentEstateId) ?? estates[0];
  const ownerProfile = useMemo(
    () =>
      businesses.find(
        (business) =>
          business.ownerUserId === user?.id ||
          business.ownerEmail === user?.email ||
          business.ownerName === user?.fullName,
      ) ?? null,
    [businesses, user?.email, user?.fullName, user?.id],
  );
  const savedOwnerProfile = useMemo(
    () => getOwnerBusinessProfile(user),
    [getOwnerBusinessProfile, user],
  );
  const riverParkVerified = isRiverParkVerifiedForUser(user);
  const [form, setForm] = useState<BusinessProfileFormValues>(
    createInitialForm(
      currentEstateId,
      user?.fullName ?? '',
      user?.email ?? '',
      user?.phoneNumber ?? '',
      ownerProfile,
      savedOwnerProfile,
    ),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessProfileFormValues, string>>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryOptions = useMemo(
    () => categoriesForListingType(form.listingType),
    [form.listingType],
  );
  const existingServiceListing = useMemo(
    () =>
      businesses.find(
        (business) =>
          business.listingType === 'profession' &&
          (business.ownerUserId === user?.id ||
            business.ownerEmail === user?.email ||
            business.ownerName === user?.fullName),
      ),
    [businesses, user?.email, user?.fullName, user?.id],
  );

  useEffect(() => {
    if (!categoryOptions.some((category) => category === form.category)) {
      setForm((current) => ({
        ...current,
        category: categoryOptions[0] ?? current.category,
      }));
    }
  }, [categoryOptions, form.category]);

  useEffect(() => {
    if (existingServiceListing && form.listingType === 'profession') {
      setForm((current) => ({
        ...current,
        listingType: 'product',
        category: productCategories[0],
      }));
    }
  }, [existingServiceListing, form.listingType]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setForm((current) => ({
      ...current,
      ownerName: user.fullName,
      phone: savedOwnerProfile?.phone ?? ownerProfile?.contact.phone ?? user.phoneNumber,
      whatsapp: savedOwnerProfile?.whatsapp ?? ownerProfile?.contact.whatsapp ?? '',
      email: savedOwnerProfile?.email ?? ownerProfile?.contact.email ?? user.email,
      website: savedOwnerProfile?.website ?? ownerProfile?.contact.website ?? '',
      instagram: savedOwnerProfile?.instagram ?? ownerProfile?.contact.instagram ?? '',
      address:
        savedOwnerProfile?.address ??
        ownerProfile?.address ??
        `${user.businessCluster ?? 'River Park'}, River Park Estate`,
      coverImage: savedOwnerProfile?.coverImage ?? ownerProfile?.imageUrl ?? current.coverImage,
      galleryImages: savedOwnerProfile?.galleryImages ?? current.galleryImages,
      galleryVideos: savedOwnerProfile?.galleryVideos ?? current.galleryVideos,
    }));
  }, [
    ownerProfile?.id,
    savedOwnerProfile?.updatedAt,
    user?.businessCluster,
    user?.email,
    user?.fullName,
    user?.phoneNumber,
  ]);

  if (!user || user.role !== 'businessOwner') {
    return (
      <View style={styles.gateShell}>
        <Text style={styles.sectionTitle}>Business owner access only</Text>
        <Text style={styles.subtitle}>
          Sign in with a business owner account to create a product or service listing.
        </Text>
      </View>
    );
  }

  if (!riverParkVerified) {
    return (
      <View style={styles.gateShell}>
        <Text style={styles.sectionTitle}>Verify your account first</Text>
        <Text style={styles.subtitle}>
          Customer care must verify that your business owner account belongs in River Park before
          you can submit a product or service listing for approval.
        </Text>
        <View style={styles.gateActions}>
          <AppButton label="Talk to customer care" onPress={() => navigation.navigate('Chats')} />
          <AppButton
            label="Back to profile"
            onPress={() => navigation.navigate('Account')}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  const copy =
    form.listingType === 'product'
      ? {
          nameLabel: 'Item name',
          namePlaceholder: 'River Harvest Fruit Box',
          shortPlaceholder: 'What item are residents buying in one sentence?',
          longPlaceholder:
            'Explain what comes with the item, delivery expectations, and why buyers should choose it.',
          servicesLabel: 'Item highlights',
          servicesPlaceholder: 'Same-day dropoff, family-size pack, fresh stock',
          servicesHelper: 'Separate item highlights with commas.',
          priceLabel: 'Price',
          pricePlaceholder: '18000',
          buttonLabel: 'Send product for approval',
        }
      : {
          nameLabel: 'Profession or service name',
          namePlaceholder: 'River Park Home Nurse',
          shortPlaceholder: 'What service are residents booking in one sentence?',
          longPlaceholder:
            'Explain your service, response style, and what residents should expect.',
          servicesLabel: 'Services offered',
          servicesPlaceholder: 'Medication support, home visits, post-op checks',
          servicesHelper: 'Separate services with commas.',
          priceLabel: '',
          pricePlaceholder: '',
          buttonLabel: 'Send service for approval',
        };

  const updateField = <K extends keyof BusinessProfileFormValues>(
    key: K,
    value: BusinessProfileFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  };

  const pickListingMedia = async (
    field: 'coverImage' | 'galleryImages' | 'galleryVideos',
    mediaTypes: ImagePicker.MediaType[],
    allowsMultipleSelection: boolean,
  ) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow gallery access in your device settings so you can add listing images and videos.',
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
      allowsMultipleSelection,
      mediaTypes,
      quality: 1,
      selectionLimit: allowsMultipleSelection ? 0 : 1,
    });

    if (result.canceled) {
      return;
    }

    const nextUris = result.assets.map((asset) => asset.uri).filter(Boolean);

    if (nextUris.length === 0) {
      return;
    }

    if (field === 'coverImage') {
      updateField('coverImage', nextUris[0] ?? '');
      return;
    }

    updateField(field, mergeSelectedUris(form[field], nextUris));
  };

  const fillTestListing = (listingType: ListingType = form.listingType) => {
    setForm((current) => createRandomListingForm(current, listingType));
    setErrors({});
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof BusinessProfileFormValues, string>> = {};
    const parsedPrice = Number.parseFloat(form.price);
    const parsedStockQuantity = Number.parseInt(form.stockQuantity, 10);
    const parsedReorderLevel = Number.parseInt(form.reorderLevel, 10);

    if (!form.businessName.trim()) {
      nextErrors.businessName = 'This name is required.';
    }
    if (!form.ownerName.trim()) {
      nextErrors.ownerName = 'Owner name is required.';
    }
    if (!form.shortDescription.trim()) {
      nextErrors.shortDescription = 'Add a short summary for the listing card.';
    }
    if (!form.longDescription.trim()) {
      nextErrors.longDescription = 'Add a detailed description for this listing.';
    }
    if (
      form.listingType === 'product' &&
      (!form.price.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0)
    ) {
      nextErrors.price = 'Add a valid item price.';
    }
    if (
      form.listingType === 'product' &&
      (!form.stockQuantity.trim() ||
        !Number.isFinite(parsedStockQuantity) ||
        parsedStockQuantity < 0)
    ) {
      nextErrors.stockQuantity = 'Add a valid stock quantity.';
    }
    if (
      form.listingType === 'product' &&
      (!form.reorderLevel.trim() ||
        !Number.isFinite(parsedReorderLevel) ||
        parsedReorderLevel <= 0)
    ) {
      nextErrors.reorderLevel = 'Add a valid reorder level.';
    }
    if (!form.services.trim()) {
      nextErrors.services = 'Add at least one highlight or service.';
    }
    if (form.listingType === 'profession' && existingServiceListing) {
      nextErrors.services = 'This business already has one service profile.';
    }

    return nextErrors;
  };

  const previewBusiness = createPreviewBusiness(form);
  const coverAssets = form.coverImage
    ? [{ label: assetLabelFromUri(form.coverImage, 'Cover image', 0), uri: form.coverImage }]
    : [];
  const galleryImageAssets = assetsFromValue(form.galleryImages, 'Listing image');
  const galleryVideoAssets = assetsFromValue(form.galleryVideos, 'Listing video');

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!riverParkVerified) {
      Alert.alert(
        'Verify your account first',
        'Customer care must verify your River Park account before you can create a listing.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Talk to customer care', onPress: () => navigation.navigate('Chats') },
        ],
      );
      return;
    }

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const createdBusiness = await registerBusiness(form, user);

      Alert.alert(
        'Sent to customer care',
        'Your listing was submitted. Customer care will inspect it, and your paid subscription controls when it can go live.',
        [
          {
            text: 'View listing',
            onPress: () =>
              navigation.navigate('BusinessDetails', { businessId: createdBusiness.id }),
          },
        ],
      );

      setForm(
        createInitialForm(
          form.estateId,
          user.fullName,
          user.email,
          user.phoneNumber,
          ownerProfile,
          savedOwnerProfile,
        ),
      );
      setErrors({});
    } catch (submitError) {
      Alert.alert(
        'Unable to submit',
        submitError instanceof Error
          ? submitError.message
          : 'Customer care could not receive this submission right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroOrbOne} />
        <View style={styles.heroOrbTwo} />
        <Text style={styles.eyebrow}>Business onboarding</Text>
        <Text style={styles.title}>Create a clean River Park listing for approval.</Text>
        <Text style={styles.subtitle}>
          Subscription payment is managed from the Subscription page. This form is only for the item or
          service details customer care needs to inspect.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Listing type</Text>
        <View style={styles.chipWrap}>
          {(['product', 'profession'] as ListingType[]).map((listingType) => {
            const isSelected = form.listingType === listingType;
            const isDisabled = listingType === 'profession' && Boolean(existingServiceListing);

            return (
              <Pressable
                disabled={isDisabled}
                key={listingType}
                onPress={() => {
                  if (!isDisabled) {
                    updateField('listingType', listingType);
                  }
                }}
                style={[
                  styles.selectionChip,
                  isSelected && styles.selectionChipActive,
                  isDisabled && styles.selectionChipDisabled,
                ]}
              >
                <Text style={[styles.selectionText, isSelected && styles.selectionTextActive]}>
                  {listingType === 'product'
                    ? 'Selling items'
                    : isDisabled
                      ? 'Rendering services already created'
                      : 'Rendering services'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {existingServiceListing ? (
          <Text style={styles.sectionHelper}>
            You already have one service profile. You can still create as many selling item listings
            as you need.
          </Text>
        ) : null}
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.sectionTitle}>Live preview</Text>
        <View style={styles.previewCard}>
          <Image resizeMode="cover" source={{ uri: previewBusiness.imageUrl }} style={styles.previewImage} />
          <View style={styles.previewBody}>
            <View style={styles.previewBadgeRow}>
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>{previewBusiness.category}</Text>
              </View>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{previewBusiness.cluster}</Text>
            </View>
            {form.listingType === 'product' ? (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>
                  Stock {previewBusiness.stockQuantity ?? 0}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.previewTitle}>{previewBusiness.name}</Text>
          <Text style={styles.previewMeta}>by {previewBusiness.ownerName}</Text>
            <Text style={styles.previewText}>{previewBusiness.description}</Text>
            <Text style={styles.previewPrice}>
              {form.listingType === 'product'
                ? previewBusiness.price > 0
                  ? formatCurrency(previewBusiness.price)
                  : 'Add product price'
                : 'Customer care coordinates service details'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>River Park setup</Text>
        <View style={styles.lockedCard}>
          <Text style={styles.lockedTitle}>{currentEstate?.name ?? 'River Park Estate'}</Text>
          <Text style={styles.lockedCopy}>
            This release is still limited to River Park. Choose the cluster where buyers or clients
            can find you first.
          </Text>
        </View>
        <View style={styles.chipWrap}>
          {riverParkClusters.map((cluster) => {
            const isSelected = cluster === form.cluster;

            return (
              <Pressable
                key={cluster}
                onPress={() => updateField('cluster', cluster)}
                style={[styles.selectionChip, isSelected && styles.selectionChipActive]}
              >
                <Text style={[styles.selectionText, isSelected && styles.selectionTextActive]}>
                  {cluster}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chipWrap}>
          {categoryOptions.map((category) => {
            const isSelected = category === form.category;

            return (
              <Pressable
                key={category}
                onPress={() => updateField('category', category)}
                style={[styles.selectionChip, isSelected && styles.selectionChipActive]}
              >
                <Text style={[styles.selectionText, isSelected && styles.selectionTextActive]}>
                  {category}
                </Text>
              </Pressable>
          );
          })}
        </View>
      </View>

      <View style={styles.formSection}>
        <View style={styles.testFillRow}>
          <Pressable
            onPress={() => fillTestListing('product')}
            style={({ pressed }) => [
              styles.testFillButton,
              pressed && styles.testFillButtonPressed,
            ]}
          >
            <Ionicons color={colors.white} name="sparkles-outline" size={18} />
            <Text style={styles.testFillButtonText}>Random product</Text>
          </Pressable>
          <Pressable
            disabled={Boolean(existingServiceListing)}
            onPress={() => fillTestListing('profession')}
            style={({ pressed }) => [
              styles.testFillButton,
              styles.testFillButtonSecondary,
              pressed && !existingServiceListing && styles.testFillButtonPressed,
              existingServiceListing && styles.testFillButtonDisabled,
            ]}
          >
            <Ionicons color={colors.white} name="construct-outline" size={18} />
            <Text style={styles.testFillButtonText}>Random service</Text>
          </Pressable>
        </View>
        <FormField
          error={errors.businessName}
          label={copy.nameLabel}
          onChangeText={(value) => updateField('businessName', value)}
          placeholder={copy.namePlaceholder}
          value={form.businessName}
        />
        <FormField
          error={errors.ownerName}
          label="Owner name"
          onChangeText={(value) => updateField('ownerName', value)}
          placeholder="Ada Nwosu"
          value={form.ownerName}
        />
        {form.listingType === 'product' ? (
          <>
            <FormField
              error={errors.price}
              keyboardType="numeric"
              label={copy.priceLabel}
              onChangeText={(value) => updateField('price', value)}
              placeholder={copy.pricePlaceholder}
              value={form.price}
            />
            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <FormField
                  error={errors.stockQuantity}
                  helper="Available units for checkout."
                  keyboardType="numeric"
                  label="Stock quantity"
                  onChangeText={(value) => updateField('stockQuantity', value)}
                  placeholder="12"
                  value={form.stockQuantity}
                />
              </View>
              <View style={styles.inlineField}>
                <FormField
                  error={errors.reorderLevel}
                  helper="Alert level for low stock."
                  keyboardType="numeric"
                  label="Reorder level"
                  onChangeText={(value) => updateField('reorderLevel', value)}
                  placeholder="5"
                  value={form.reorderLevel}
                />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.planNotice}>
            <Text style={styles.planNoticeText}>
              Services do not show a public amount. Customer care will help coordinate next steps
              when a resident needs support.
            </Text>
          </View>
        )}
        <FormField
          error={errors.shortDescription}
          helper="This appears on the marketplace card."
          label="Short description"
          multiline
          onChangeText={(value) => updateField('shortDescription', value)}
          placeholder={copy.shortPlaceholder}
          value={form.shortDescription}
        />
        <FormField
          error={errors.longDescription}
          helper="This powers the full details page."
          label="Detailed description"
          multiline
          onChangeText={(value) => updateField('longDescription', value)}
          placeholder={copy.longPlaceholder}
          value={form.longDescription}
        />
        <FormField
          error={errors.services}
          helper={copy.servicesHelper}
          label={copy.servicesLabel}
          multiline
          onChangeText={(value) => updateField('services', value)}
          placeholder={copy.servicesPlaceholder}
          value={form.services}
        />
        <MediaPickerField
          assets={coverAssets}
          buttonLabel="Add cover image"
          helper="This image appears first on the listing card and details page."
          kind="image"
          label="Listing cover image"
          onClear={() => updateField('coverImage', '')}
          onPick={() => {
            void pickListingMedia('coverImage', ['images'], false);
          }}
        />
        <MediaPickerField
          assets={galleryImageAssets}
          buttonLabel="Add listing photos"
          helper="Select photos that help customer care inspect the product or service."
          kind="image"
          label="Listing photos"
          onClear={() => updateField('galleryImages', '')}
          onPick={() => {
            void pickListingMedia('galleryImages', ['images'], true);
          }}
        />
        <MediaPickerField
          assets={galleryVideoAssets}
          buttonLabel="Add listing videos"
          helper="Select videos that show the item, shop, or service setup."
          kind="video"
          label="Listing videos"
          onClear={() => updateField('galleryVideos', '')}
          onPick={() => {
            void pickListingMedia('galleryVideos', ['videos'], true);
          }}
        />
        <View style={styles.planNotice}>
          <Text style={styles.planNoticeText}>
            Contact details and address are managed from the Profile screen in Edit business
            profile.
          </Text>
        </View>
      </View>

      <AppButton
        disabled={isSubmitting}
        label={isSubmitting ? 'Sending...' : copy.buttonLabel}
        loading={isSubmitting}
        onPress={() => {
          void handleSubmit();
        }}
      />
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    hero: {
      position: 'relative',
      overflow: 'hidden',
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroOrbOne: {
      position: 'absolute',
      top: -24,
      right: -16,
      height: 132,
      width: 132,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.28)',
    },
    heroOrbTwo: {
      position: 'absolute',
      bottom: -44,
      left: -18,
      height: 148,
      width: 148,
      borderRadius: 999,
      backgroundColor: 'rgba(217, 237, 242, 0.16)',
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
    gateShell: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    gateActions: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    previewSection: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    previewCard: {
      overflow: 'hidden',
      borderRadius: radii.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewImage: {
      height: 210,
      width: '100%',
    },
    previewBody: {
      gap: spacing.sm,
      padding: spacing.lg,
    },
    previewBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    previewBadge: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    previewBadgeText: {
      ...typography.caption,
      color: colors.primary,
    },
    previewTitle: {
      ...typography.section,
      color: colors.text,
    },
    previewMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    previewText: {
      ...typography.body,
      color: colors.textMuted,
    },
    previewPrice: {
      ...typography.subtitle,
      color: colors.primary,
    },
    section: {
      gap: spacing.md,
    },
    sectionHelper: {
      ...typography.body,
      color: colors.textMuted,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    lockedCard: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    lockedTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    lockedCopy: {
      ...typography.caption,
      color: colors.textMuted,
    },
    planWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    planCard: {
      flex: 1,
      minWidth: 160,
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    planCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    planTitle: {
      ...typography.caption,
      color: colors.textMuted,
    },
    planTitleActive: {
      color: colors.primary,
    },
    planAmount: {
      ...typography.subtitle,
      color: colors.text,
    },
    planAmountActive: {
      color: colors.primary,
    },
    planCopy: {
      ...typography.caption,
      color: colors.textMuted,
    },
    planCopyActive: {
      color: colors.primary,
    },
    planNotice: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    planNoticeText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    formSection: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    testFillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    testFillButton: {
      minHeight: 48,
      flex: 1,
      minWidth: 150,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      ...shadows.soft,
    },
    testFillButtonSecondary: {
      backgroundColor: colors.secondary,
    },
    testFillButtonDisabled: {
      opacity: 0.52,
    },
    testFillButtonPressed: {
      opacity: 0.9,
      transform: [{ translateY: 1 }],
    },
    testFillButtonText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
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
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    selectionChip: {
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    selectionChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectionChipDisabled: {
      opacity: 0.52,
    },
    selectionText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    selectionTextActive: {
      color: colors.white,
    },
  });
}
