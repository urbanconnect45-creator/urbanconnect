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
  type OwnerBusinessProfileValues,
} from '../types/business';
import { buildBusinessMedia } from '../utils/businessMedia';
import { splitInputList } from '../utils/businessMedia';
import { inferListingCategory } from '../utils/category';
import { formatCurrency } from '../utils/format';

const foodListingReference = require('../../assets/food-listing-reference.jpeg');

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
    facebook: profile?.contact.facebook ?? '',
    x: profile?.contact.x ?? '',
    tiktok: profile?.contact.tiktok ?? '',
    address: savedProfile?.address ?? profile?.address ?? '',
    coverImage: savedProfile?.coverImage ?? profile?.imageUrl ?? '',
    galleryImages: savedProfile?.galleryImages ?? '',
    galleryVideos: savedProfile?.galleryVideos ?? '',
    services: '',
    foodAllergies: '',
    foodExtras: '',
    preparationTime: '',
    portionSize: '',
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
        ? 'Use the detailed description to explain what buyers get, delivery expectations, and why this item stands out.'
        : 'Use the detailed description to explain your service style, response time, and why residents should trust you.'),
    imageUrl: media[0]?.url ?? fallbackImage,
    media,
    address: values.address || 'Advertiser location',
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
      ...(values.facebook ? { facebook: values.facebook } : {}),
      ...(values.x ? { x: values.x } : {}),
      ...(values.tiktok ? { tiktok: values.tiktok } : {}),
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
    getOwnerBusinessProfile,
    registerBusiness,
    updateOwnerBusinessProfile,
  } = useBusinessDirectory();
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
  const isIndividualSeller = user?.role === 'resident';
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
  const [storeHours, setStoreHours] = useState({
    openingTime: savedOwnerProfile?.openingTime ?? '',
    closingTime: savedOwnerProfile?.closingTime ?? '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);

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
      facebook: ownerProfile?.contact.facebook ?? current.facebook ?? '',
      x: ownerProfile?.contact.x ?? current.x ?? '',
      tiktok: ownerProfile?.contact.tiktok ?? current.tiktok ?? '',
      address:
        savedOwnerProfile?.address ??
        ownerProfile?.address ??
        user.businessCluster ?? '',
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

  useEffect(() => {
    setStoreHours({
      openingTime: savedOwnerProfile?.openingTime ?? '',
      closingTime: savedOwnerProfile?.closingTime ?? '',
    });
  }, [savedOwnerProfile?.closingTime, savedOwnerProfile?.openingTime]);

  if (!user) {
    return (
      <View style={styles.gateShell}>
        <Text style={styles.sectionTitle}>Sign in to post</Text>
        <Text style={styles.subtitle}>
          Use your customer account to post an advertisement for review.
        </Text>
      </View>
    );
  }

  const isFoodListing =
    form.listingType === 'product' && form.category === 'Food';
  const needsAllergyCopy =
    form.listingType === 'product' &&
    ['Food', 'Drinks', 'Infant'].includes(form.category);
  const copy =
    form.listingType === 'product'
      ? {
          nameLabel: isIndividualSeller ? 'Advertisement title' : 'Item name',
          namePlaceholder: isIndividualSeller
            ? 'Clean iPhone, Toyota Corolla, mini flat, generator'
            : isFoodListing
              ? 'Jollof rice and chicken'
              : 'Everyday product name',
          shortPlaceholder: needsAllergyCopy
            ? 'Brief description, ingredients, and allergy information when relevant.'
            : isIndividualSeller
              ? 'Describe the advertisement in one short sentence.'
              : 'Describe the item in one short sentence.',
          priceLabel: isIndividualSeller ? 'Advertised price' : 'Price',
          pricePlaceholder: '18000',
          buttonLabel: isIndividualSeller ? 'Post advertisement for approval' : 'Send product for approval',
        }
      : {
          nameLabel: isIndividualSeller ? 'Advertisement title' : 'Profession or service name',
          namePlaceholder: 'Trusted Home Nurse',
          shortPlaceholder: isIndividualSeller
            ? 'What service or offer are you advertising?'
            : 'What service are residents booking in one sentence?',
          priceLabel: '',
          pricePlaceholder: '',
          buttonLabel: isIndividualSeller ? 'Post advertisement for approval' : 'Send service for approval',
        };

  const updateField = <K extends keyof BusinessProfileFormValues>(
    key: K,
    value: BusinessProfileFormValues[K],
  ) => {
    setForm((current) => {
      const nextForm = { ...current, [key]: value };

      if (
        !categoryManuallySelected &&
        nextForm.listingType === 'product' &&
        (key === 'businessName' ||
          key === 'shortDescription' ||
          key === 'longDescription')
      ) {
        const inferredCategory = inferListingCategory(
          nextForm.businessName,
          nextForm.shortDescription,
          nextForm.longDescription,
        );

        if (inferredCategory) {
          nextForm.category = inferredCategory;
        }
      }

      return nextForm;
    });
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

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof BusinessProfileFormValues, string>> = {};
    const parsedPrice = Number.parseFloat(form.price);
    const parsedStockQuantity = Number.parseInt(form.stockQuantity, 10);
    const parsedReorderLevel = Number.parseInt(form.reorderLevel, 10);

    if (!form.businessName.trim()) {
      nextErrors.businessName = 'This name is required.';
    }
    if (!form.shortDescription.trim()) {
      nextErrors.shortDescription = 'Add a short summary for the listing card.';
    }
    if (
      form.listingType === 'product' &&
      (!form.price.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0)
    ) {
      nextErrors.price = 'Add a valid item price.';
    }
    if (
      form.listingType === 'product' &&
      !isIndividualSeller &&
      (!form.stockQuantity.trim() ||
        !Number.isFinite(parsedStockQuantity) ||
        parsedStockQuantity < 0)
    ) {
      nextErrors.stockQuantity = 'Add a valid stock quantity.';
    }
    if (
      form.listingType === 'product' &&
      !isIndividualSeller &&
      (!form.reorderLevel.trim() ||
        !Number.isFinite(parsedReorderLevel) ||
        parsedReorderLevel <= 0)
    ) {
      nextErrors.reorderLevel = 'Add a valid reorder level.';
    }
    if (form.listingType === 'profession' && existingServiceListing) {
      nextErrors.businessName = 'This business already has one service profile.';
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

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (user.role === 'businessOwner') {
        const profileValues: OwnerBusinessProfileValues = {
          ownerName: savedOwnerProfile?.ownerName ?? user.businessName ?? user.fullName,
          phone: savedOwnerProfile?.phone ?? user.phoneNumber,
          whatsapp: savedOwnerProfile?.whatsapp ?? user.phoneNumber,
          email: savedOwnerProfile?.email ?? user.email,
          website: savedOwnerProfile?.website ?? '',
          instagram: savedOwnerProfile?.instagram ?? '',
          address: savedOwnerProfile?.address ?? user.businessCluster ?? '',
          openingTime: storeHours.openingTime,
          closingTime: storeHours.closingTime,
          coverImage: savedOwnerProfile?.coverImage ?? '',
          galleryImages: savedOwnerProfile?.galleryImages ?? '',
          galleryVideos: savedOwnerProfile?.galleryVideos ?? '',
        };

        await updateOwnerBusinessProfile(user, profileValues);
      }

      const submissionForm = {
        ...form,
        longDescription: form.shortDescription.trim(),
        services: '',
      };
      const createdBusiness = await registerBusiness(submissionForm, user);

      Alert.alert(
        'Sent for review',
        isIndividualSeller
          ? 'Your advertisement was submitted for admin review. It appears on Home after approval.'
          : 'Your listing was submitted for admin review. Listing is free and appears after approval.',
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
        <Text style={styles.eyebrow}>
          {isIndividualSeller ? 'Customer advertisement' : 'Business onboarding'}
        </Text>
        <Text style={styles.title}>
          {isIndividualSeller
            ? 'Post an advertisement from your customer account.'
            : 'Create a clean marketplace listing for approval.'}
        </Text>
        <Text style={styles.subtitle}>
          {isIndividualSeller
            ? 'Advertisements are free. Buyers contact you directly; there is no cart, checkout, delivery, or withdrawal flow.'
            : 'Listing is free. This form is only for the item or service details customer care needs to inspect.'}
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
                    setCategoryManuallySelected(false);
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
                    ? isIndividualSeller ? 'Post item advertisement' : 'Selling items'
                    : isDisabled
                      ? 'Rendering services already created'
                      : isIndividualSeller ? 'Post service advertisement' : 'Rendering services'}
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
            {form.listingType === 'product' ? (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>
                  Stock {previewBusiness.stockQuantity ?? 0}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.previewTitle}>{previewBusiness.name}</Text>
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
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.chipWrap}>
          {categoryOptions.map((category) => {
            const isSelected = category === form.category;

            return (
              <Pressable
                key={category}
                onPress={() => {
                  setCategoryManuallySelected(true);
                  updateField('category', category);
                }}
                style={[styles.selectionChip, isSelected && styles.selectionChipActive]}
              >
                <Text style={[styles.selectionText, isSelected && styles.selectionTextActive]}>
                  {category}
                </Text>
              </Pressable>
          );
          })}
        </View>
        <Text style={styles.sectionHelper}>
          {categoryManuallySelected
            ? 'You selected this category manually.'
            : 'View2Connect suggests a category from the item name and description. You can change it.'}
        </Text>
      </View>

      <View style={styles.formSection}>
        {isFoodListing ? (
          <View style={styles.foodVisual}>
            <Image source={foodListingReference} style={styles.foodVisualImage} />
            <View style={styles.foodVisualOverlay} />
            <View style={styles.foodVisualCopy}>
              <Text style={styles.foodVisualEyebrow}>Food listing</Text>
              <Text style={styles.foodVisualTitle}>Add meal details buyers need before ordering.</Text>
            </View>
          </View>
        ) : null}
        <FormField
          error={errors.businessName}
          label={copy.nameLabel}
          onChangeText={(value) => updateField('businessName', value)}
          placeholder={copy.namePlaceholder}
          value={form.businessName}
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
            {!isIndividualSeller ? (
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
            ) : null}
          </>
        ) : (
          <View style={styles.planNotice}>
            <Text style={styles.planNoticeText}>
              {isIndividualSeller
                ? 'Service advertisements do not use app checkout. Buyers contact you directly.'
                : 'Services do not show a public amount. Customer care will help coordinate next steps when a resident needs support.'}
            </Text>
          </View>
        )}
        <FormField
          error={errors.shortDescription}
          helper="This appears on the marketplace card."
          label={needsAllergyCopy ? 'Short description / allergy note' : 'Short description'}
          multiline
          onChangeText={(value) => updateField('shortDescription', value)}
          placeholder={copy.shortPlaceholder}
          value={form.shortDescription}
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
        {isIndividualSeller ? (
          <View style={styles.planNotice}>
            <Text style={styles.planNoticeText}>
              Buyers will use these details to contact the advertiser directly.
            </Text>
            <FormField
              label="Phone number"
              onChangeText={(value) => updateField('phone', value)}
              placeholder="+234..."
              value={form.phone}
            />
            <FormField
              label="WhatsApp number"
              onChangeText={(value) => updateField('whatsapp', value)}
              placeholder="+234..."
              value={form.whatsapp}
            />
            <FormField
              label="Email address"
              onChangeText={(value) => updateField('email', value)}
              placeholder="advertiser@example.com"
              value={form.email}
            />
            <FormField
              label="Location"
              onChangeText={(value) => updateField('address', value)}
              placeholder="Lugbe, Abuja"
              value={form.address}
            />
            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <FormField
                  label="Instagram"
                  onChangeText={(value) => updateField('instagram', value)}
                  placeholder="@yourhandle"
                  value={form.instagram}
                />
              </View>
              <View style={styles.inlineField}>
                <FormField
                  label="Facebook"
                  onChangeText={(value) => updateField('facebook', value)}
                  placeholder="Facebook name"
                  value={form.facebook ?? ''}
                />
              </View>
            </View>
            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <FormField
                  label="X / Twitter"
                  onChangeText={(value) => updateField('x', value)}
                  placeholder="@yourhandle"
                  value={form.x ?? ''}
                />
              </View>
              <View style={styles.inlineField}>
                <FormField
                  label="TikTok"
                  onChangeText={(value) => updateField('tiktok', value)}
                  placeholder="@yourhandle"
                  value={form.tiktok ?? ''}
                />
              </View>
            </View>
          </View>
        ) : null}
        {!isIndividualSeller ? (
          <View style={styles.planNotice}>
            <Text style={styles.planNoticeText}>
              Store opening and closing time will be saved to your seller profile.
            </Text>
            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <FormField
                  label="Opening time"
                  onChangeText={(value) =>
                    setStoreHours((current) => ({ ...current, openingTime: value }))
                  }
                  placeholder="09:00 AM"
                  value={storeHours.openingTime}
                />
              </View>
              <View style={styles.inlineField}>
                <FormField
                  label="Closing time"
                  onChangeText={(value) =>
                    setStoreHours((current) => ({ ...current, closingTime: value }))
                  }
                  placeholder="08:00 PM"
                  value={storeHours.closingTime}
                />
              </View>
            </View>
          </View>
        ) : null}
        {!isIndividualSeller ? (
          <View style={styles.planNotice}>
            <Text style={styles.planNoticeText}>
              Contact details and address are managed from the Profile screen in Edit business
              profile.
            </Text>
          </View>
        ) : null}
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
    foodVisual: {
      position: 'relative',
      minHeight: 210,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      borderRadius: radii.lg,
      backgroundColor: colors.overlay,
    },
    foodVisualImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      aspectRatio: 498 / 1120,
    },
    foodVisualOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(24, 14, 36, 0.48)',
    },
    foodVisualCopy: {
      position: 'relative',
      gap: spacing.xs,
      padding: spacing.lg,
    },
    foodVisualEyebrow: {
      ...typography.eyebrow,
      color: '#F2C45A',
    },
    foodVisualTitle: {
      ...typography.section,
      maxWidth: 520,
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
