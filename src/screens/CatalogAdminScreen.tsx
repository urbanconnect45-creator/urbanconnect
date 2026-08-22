import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import { MediaPickerField } from '../components/MediaPickerField';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import {
  fetchSupabaseUserProfiles,
  isSupabaseConfigured,
} from '../services/supabaseApi';
import type { AppUser } from '../types/auth';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import {
  productCategories,
  type CentralCatalogProductValues,
} from '../types/business';
import { inferListingCategory } from '../utils/category';
import { formatCurrency } from '../utils/format';

const previewFallbackImage =
  'https://images.unsplash.com/photo-1513708922074-9bf9452d8f6f?auto=format&fit=crop&w=900&q=80';

const emptyCatalogForm: CentralCatalogProductValues = {
  name: '',
  category: productCategories[0],
  price: '',
  description: '',
  image: '',
  hasBarcode: false,
  barcode: '',
  hasSize: false,
  size: '',
};

export function CatalogAdminScreen() {
  const { adminUser, users } = useAuth();
  const {
    businesses,
    centralCatalogProducts,
    createCentralCatalogProduct,
    deleteBusiness,
    hasCatalogManagementAccess,
    ownerBusinessProfiles,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const [form, setForm] = useState<CentralCatalogProductValues>(emptyCatalogForm);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [liveUsers, setLiveUsers] = useState<AppUser[]>([]);
  const requestedOwnerId = useMemo(() => {
    if (Platform.OS !== 'web') {
      return '';
    }

    const search =
      (globalThis as { location?: { search?: string } }).location?.search ?? '';
    return new URLSearchParams(search).get('owner')?.trim() ?? '';
  }, []);
  const managedOwner = useMemo(
    () =>
      requestedOwnerId
        ? [...liveUsers, ...users].find(
            (candidate) =>
              candidate.id === requestedOwnerId && candidate.role === 'businessOwner',
          )
        : undefined,
    [liveUsers, requestedOwnerId, users],
  );
  const managedOwnerProfile = useMemo(
    () =>
      managedOwner
        ? ownerBusinessProfiles.find(
            (profile) => profile.ownerUserId === managedOwner.id,
          )
        : undefined,
    [managedOwner, ownerBusinessProfiles],
  );
  const managedCatalogAccess =
    Boolean(managedOwner) && hasCatalogManagementAccess(managedOwner?.id ?? '');
  const catalogProducts = managedOwner
    ? businesses.filter(
        (business) =>
          business.ownerUserId === managedOwner.id &&
          business.tags.includes('Admin managed catalog'),
      )
    : centralCatalogProducts;
  const needsAllergyCopy = ['Food', 'Drinks', 'Infant'].includes(form.category);

  useEffect(() => {
    if (!requestedOwnerId || !isSupabaseConfigured) {
      return;
    }

    void fetchSupabaseUserProfiles()
      .then(setLiveUsers)
      .catch(() => setLiveUsers([]));
  }, [requestedOwnerId]);
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalogProducts.filter((product) =>
      [product.name, product.sku, product.category, ...product.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [catalogProducts, query]);

  const updateField = <K extends keyof CentralCatalogProductValues>(
    key: K,
    value: CentralCatalogProductValues[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (
        !categoryManuallySelected &&
        (key === 'name' || key === 'description')
      ) {
        const inferredCategory = inferListingCategory(next.name, next.description);

        if (inferredCategory) {
          next.category = inferredCategory;
        }
      }

      return next;
    });
    setError(null);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a catalog image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      updateField('image', result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow camera access to photograph this catalog item.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      updateField('image', result.assets[0].uri);
    }
  };

  const createCatalogProductPreview = (values: CentralCatalogProductValues) => ({
    imageUrl: values.image.trim() || previewFallbackImage,
    name: values.name.trim() || 'New catalog item',
    category: values.category,
    description:
      values.description.trim() || 'A preview of the item as it will appear to sellers.',
    price: Number.parseFloat(values.price) || 0,
    tags: [
      values.hasSize && values.size.trim() ? `Size: ${values.size.trim()}` : null,
      values.hasBarcode && values.barcode.trim() ? `Barcode: ${values.barcode.trim()}` : null,
    ].filter(Boolean) as string[],
  });

  const previewProduct = createCatalogProductPreview(form);

  const saveProduct = async () => {
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    const price = Number.parseFloat(form.price);

    if (!form.price.trim() || !Number.isFinite(price) || price <= 0) {
      setError('Enter a valid product price.');
      return;
    }

    if (!form.description.trim()) {
      setError('Add a short catalog description.');
      return;
    }

    if (!form.image.trim()) {
      setError('Add a clean product image.');
      return;
    }

    if (form.hasBarcode && !form.barcode.trim()) {
      setError('Enter the barcode or select No.');
      return;
    }

    if (form.hasSize && !form.size.trim()) {
      setError('Enter the product size or select No.');
      return;
    }

    if (isSupabaseConfigured && !/^\d{4}$/.test(adminPin)) {
      setError('Enter the 4 digit Admin PIN before saving this catalog product.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await createCentralCatalogProduct(form, managedOwner, adminPin);
      setForm(emptyCatalogForm);
      setAdminPin('');
      setCategoryManuallySelected(false);
      Alert.alert(
        'Catalog updated',
        managedOwner
          ? `The product was added to ${managedOwner.businessName ?? managedOwner.fullName}.`
          : 'The product is available to sellers in their portal.',
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Unable to save this catalog product.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (adminUser?.role !== 'owner') {
    return (
      <View style={styles.gate}>
        <Ionicons color={colors.primary} name="lock-closed-outline" size={34} />
        <Text style={styles.title}>Owner catalog access only</Text>
        <Text style={styles.muted}>
          Sign in with the owner admin account to create the marketplace catalog.
        </Text>
      </View>
    );
  }

  if (requestedOwnerId && (!managedOwner || !managedCatalogAccess)) {
    return (
      <View style={styles.gate}>
        <Ionicons color={colors.danger} name="shield-outline" size={34} />
        <Text style={styles.title}>Store catalog access unavailable</Text>
        <Text style={styles.muted}>
          This seller was not found or no longer allows View2Connect Admin to manage
          their catalog. Return to Managed catalogs in Admin and open an active store.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons color={colors.white} name="albums-outline" size={26} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>
            {managedOwner ? 'Admin-assisted store catalog' : 'Owner catalog studio'}
          </Text>
          <Text style={styles.heroTitle}>
            {managedOwner
              ? `Build ${managedOwner.businessName ?? managedOwner.fullName}'s store.`
              : 'Create the products every seller can reuse.'}
          </Text>
          <Text style={styles.heroText}>
            {managedOwner
              ? `${managedOwnerProfile?.address ?? 'Seller address not added'}. Permission remains controlled by the seller.`
              : 'Choose a category, add the item name, price, short description, and a clear image. Sellers can reuse it without retyping the product.'}
          </Text>
        </View>
      </View>

      <View style={styles.workspace}>
        <View style={styles.editor}>
          <Text style={styles.sectionTitle}>Catalog product</Text>
          <FormField
            label="Product name"
            onChangeText={(value) => updateField('name', value)}
            placeholder={form.category === 'Food' ? 'Jollof rice and chicken' : 'Product name'}
            value={form.name}
          />
          <View style={styles.categoryWrap}>
            {productCategories.map((category) => {
              const active = form.category === category;

              return (
                <Pressable
                  key={category}
                  onPress={() => {
                    setCategoryManuallySelected(true);
                    updateField('category', category);
                  }}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helper}>
            The category is suggested from the product name. Select another category when needed.
          </Text>
          <FormField
            keyboardType="numeric"
            label="Price"
            onChangeText={(value) => updateField('price', value.replace(/[^\d.]/g, ''))}
            placeholder="1500"
            value={form.price}
          />
          <View style={styles.optionalDetails}>
              <View style={styles.choiceBlock}>
                <Text style={styles.choiceLabel}>Does this item have a barcode?</Text>
                <View style={styles.choiceRow}>
                  {[true, false].map((value) => {
                    const active = form.hasBarcode === value;

                    return (
                      <Pressable
                        key={String(value)}
                        onPress={() => {
                          updateField('hasBarcode', value);
                          if (!value) {
                            updateField('barcode', '');
                          }
                        }}
                        style={[styles.choiceButton, active && styles.choiceButtonActive]}
                      >
                        <Text
                          style={[styles.choiceText, active && styles.choiceTextActive]}
                        >
                          {value ? 'Yes' : 'No'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {form.hasBarcode ? (
                  <FormField
                    keyboardType="numeric"
                    label="Barcode / GTIN"
                    onChangeText={(value) =>
                      updateField('barcode', value.replace(/\D/g, ''))
                    }
                    placeholder="Enter the number under the barcode"
                    value={form.barcode}
                  />
                ) : null}
              </View>

              <View style={styles.choiceBlock}>
                <Text style={styles.choiceLabel}>
                  Does this item have a size or pack measurement?
                </Text>
                <View style={styles.choiceRow}>
                  {[true, false].map((value) => {
                    const active = form.hasSize === value;

                    return (
                      <Pressable
                        key={String(value)}
                        onPress={() => {
                          updateField('hasSize', value);
                          if (!value) {
                            updateField('size', '');
                          }
                        }}
                        style={[styles.choiceButton, active && styles.choiceButtonActive]}
                      >
                        <Text
                          style={[styles.choiceText, active && styles.choiceTextActive]}
                        >
                          {value ? 'Yes' : 'No'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {form.hasSize ? (
                  <FormField
                    label="Size / pack measurement"
                    onChangeText={(value) => updateField('size', value)}
                    placeholder="Examples: 500 ml, 1 kg, 6 pieces"
                    value={form.size}
                  />
                ) : null}
              </View>
            </View>
          <FormField
            label={needsAllergyCopy ? 'Short description / allergy note' : 'Short description'}
            multiline
            onChangeText={(value) => updateField('description', value)}
            placeholder={
              needsAllergyCopy
                ? 'Brief item description. Include allergy or ingredient information when relevant.'
                : 'Briefly describe the item.'
            }
            value={form.description}
          />
          <MediaPickerField
            assets={
              form.image
                ? [{ label: 'Catalog image', uri: form.image }]
                : []
            }
            buttonLabel="Add product image"
            helper="Use a clear front-facing image with a plain background."
            kind="image"
            label="Product image"
            onClear={() => updateField('image', '')}
            onPick={() => {
              void pickImage();
            }}
          />

          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Seller preview</Text>
            <View style={styles.previewCard}>
              <Image
                source={{ uri: previewProduct.imageUrl }}
                style={styles.previewImage}
              />
              <View style={styles.previewCopy}>
                <Text style={styles.previewCategory}>{previewProduct.category}</Text>
                <Text style={styles.previewName}>{previewProduct.name}</Text>
                <Text style={styles.muted}>{previewProduct.description}</Text>
                <Text style={styles.previewPrice}>
                  {previewProduct.price > 0
                    ? formatCurrency(previewProduct.price)
                    : 'Price appears here'}
                </Text>
                {previewProduct.tags.map((tag) => (
                  <Text key={tag} style={styles.tagText}>{tag}</Text>
                ))}
              </View>
            </View>
          </View>
          {Platform.OS === 'web' && width < 900 ? (
            <Pressable
              accessibilityLabel="Take product photo"
              onPress={() => {
                void takePhoto();
              }}
              style={({ pressed }) => [
                styles.cameraButton,
                pressed && styles.cameraButtonPressed,
              ]}
            >
              <Ionicons color={colors.white} name="camera-outline" size={20} />
              <Text style={styles.cameraButtonText}>Take product photo</Text>
            </Pressable>
          ) : null}
          <FormField
            keyboardType="number-pad"
            label="Admin PIN"
            maxLength={4}
            onChangeText={(value) => {
              setAdminPin(value.replace(/\D/g, '').slice(0, 4));
              setError(null);
            }}
            placeholder="Enter 4 digit PIN"
            secureTextEntry
            value={adminPin}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton
            label={
              isSaving
                ? 'Saving product...'
                : managedOwner
                  ? 'Save to seller store'
                  : 'Save to central catalog'
            }
            loading={isSaving}
            onPress={() => void saveProduct()}
          />
        </View>

        <View style={styles.catalogList}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {managedOwner ? 'Store products' : 'Central catalog'}
              </Text>
              <Text style={styles.muted}>
                {catalogProducts.length}{' '}
                {managedOwner ? 'admin-managed products' : 'owner-created products'}
              </Text>
            </View>
            <FormField
              label="Search"
              onChangeText={setQuery}
              placeholder="Name or category"
              value={query}
            />
          </View>

          {visibleProducts.map((product) => (
            <View key={product.id} style={styles.productRow}>
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
              <View style={styles.productCopy}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.muted}>{product.category}</Text>
                {product.sku && !product.sku.startsWith('CAT-') ? (
                  <Text style={styles.codeText}>Barcode {product.sku}</Text>
                ) : null}
                {product.tags
                  .filter((tag) => tag.startsWith('Size: '))
                  .map((tag) => (
                    <Text key={tag} style={styles.muted}>{tag}</Text>
                  ))}
                <Text style={styles.codeText}>{formatCurrency(product.price)}</Text>
              </View>
              <Pressable
                accessibilityLabel={`Delete ${product.name}`}
                onPress={() => {
                  Alert.alert(
                    'Delete catalog product?',
                    `${product.name} will be removed from every seller catalog picker.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          deleteBusiness(product.id, adminUser.fullName, adminUser.role),
                      },
                    ],
                  );
                }}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.deleteButtonPressed,
                ]}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={19} />
              </Pressable>
            </View>
          ))}

          {visibleProducts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons color={colors.primary} name="barcode-outline" size={30} />
              <Text style={styles.productName}>No catalog products yet</Text>
              <Text style={styles.muted}>Create the first reusable product from the form.</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      backgroundColor: colors.background,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      borderRadius: 8,
      backgroundColor: colors.overlay,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    heroCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#F2C45A',
    },
    heroTitle: {
      ...typography.title,
      color: colors.white,
    },
    heroText: {
      ...typography.body,
      maxWidth: 760,
      color: '#ECE8F4',
    },
    workspace: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: spacing.lg,
    },
    editor: {
      flex: 1,
      minWidth: 310,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.soft,
    },
    optionalDetails: {
      gap: spacing.md,
    },
    cameraButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
    },
    cameraButtonPressed: {
      opacity: 0.88,
    },
    cameraButtonText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    choiceBlock: {
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    choiceLabel: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    choiceRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    choiceButton: {
      minWidth: 76,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    choiceButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    choiceText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    choiceTextActive: {
      color: colors.white,
    },
    catalogList: {
      flex: 1,
      minWidth: 310,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.soft,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    categoryWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    categoryChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    categoryChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    categoryText: {
      ...typography.caption,
      color: colors.text,
    },
    categoryTextActive: {
      color: colors.white,
    },
    helper: {
      ...typography.caption,
      color: colors.textMuted,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    listHeader: {
      gap: spacing.md,
    },
    muted: {
      ...typography.caption,
      color: colors.textMuted,
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.sm,
    },
    productImage: {
      width: 62,
      height: 62,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    productCopy: {
      flex: 1,
      gap: 2,
    },
    productName: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    codeText: {
      ...typography.caption,
      color: colors.primary,
    },
    deleteButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 42,
      height: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.surface,
    },
    deleteButtonPressed: {
      opacity: 0.78,
    },
    previewSection: {
      gap: spacing.sm,
      marginTop: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: spacing.lg,
      ...shadows.soft,
    },
    previewCard: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    previewImage: {
      width: 116,
      height: 116,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
    },
    previewCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    previewCategory: {
      ...typography.caption,
      color: colors.textMuted,
    },
    previewName: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    previewPrice: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    tagText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    empty: {
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.xxl,
    },
    gate: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    title: {
      ...typography.section,
      color: colors.text,
    },
  });
}
