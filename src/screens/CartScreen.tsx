import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { FlutterwaveCheckoutModal } from '../components/FlutterwaveCheckoutModal';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { CartScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { DeliveryLocation, DeliveryLocationSource, PaymentMethod } from '../types/business';
import {
  createManualDeliveryLocation,
  googleMapsSearchUrl,
  requestDeviceCoordinates,
  resolveLocationSuggestion,
  reverseGeocodeCoordinates,
  searchHereLocations,
  type LocationSuggestion,
} from '../services/location';
import {
  calculateProgressiveVat,
  calculateSellerPackingSupport,
  getIndividualSellerMinimumIssues,
  INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL,
} from '../utils/cart';
import { formatCurrency } from '../utils/format';
import { getPaymentMethodLabel } from '../utils/order';

const launchPaymentMethods: PaymentMethod[] = ['flutterwave', 'walletAccount'];

type FlutterwaveChannelId = 'card' | 'bank';

const flutterwaveChannels: Array<{
  id: FlutterwaveChannelId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  paymentOptions: string[];
  subtitle: string;
}> = [
  {
    id: 'card',
    label: 'Card',
    icon: 'card-outline',
    paymentOptions: ['card'],
    subtitle: 'Pay with debit or credit card',
  },
  {
    id: 'bank',
    label: 'Bank',
    icon: 'business-outline',
    paymentOptions: ['account', 'banktransfer'],
    subtitle: 'Pay by bank transfer',
  },
];

type ActiveFlutterwaveCheckout = {
  checkoutUrl: string;
  reference: string;
  title: string;
  subtitle: string;
  channelLabel: string;
};

export function CartScreen({ navigation }: CartScreenProps) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    cartEntries,
    cartTotal,
    checkoutCart,
    clearCart,
    estates,
    getAvailableAccountBalanceForUser,
    getAvailableStock,
    getCustomerDeliveryLocation,
    isBusinessOwnedByUser,
    removeFromCart,
    saveCustomerDeliveryLocation,
    securitySettings,
    startCartFlutterwaveCheckout,
    syncCustomerAccountData,
    updateCartQuantity,
  } = useBusinessDirectory();
  const defaultCluster = cartEntries[0]?.business.cluster ?? estates[0]?.clusters[0] ?? 'Cluster 1';
  const savedDeliveryLocation = getCustomerDeliveryLocation(user);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [addressSearch, setAddressSearch] = useState('');
  const [country, setCountry] = useState('');
  const [stateOrRegion, setStateOrRegion] = useState('');
  const [city, setCity] = useState('');
  const [areaOrDistrict, setAreaOrDistrict] = useState('');
  const [streetName, setStreetName] = useState('');
  const [buildingInfo, setBuildingInfo] = useState('');
  const [landmark, setLandmark] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationSource, setLocationSource] = useState<DeliveryLocationSource>('manual');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>();
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [deliveryCluster, setDeliveryCluster] = useState(defaultCluster);
  const [dispatchContactPhone, setDispatchContactPhone] = useState(user?.phoneNumber ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('flutterwave');
  const [flutterwaveChannel, setFlutterwaveChannel] = useState<FlutterwaveChannelId>('card');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);
  const [activeFlutterwaveCheckout, setActiveFlutterwaveCheckout] =
    useState<ActiveFlutterwaveCheckout | null>(null);
  const selectedFlutterwaveChannel =
    flutterwaveChannels.find((channel) => channel.id === flutterwaveChannel) ??
    flutterwaveChannels[0]!;

  useEffect(() => {
    if (!deliveryCluster.trim()) {
      setDeliveryCluster(defaultCluster);
    }
  }, [defaultCluster, deliveryCluster]);

  useEffect(() => {
    setDispatchContactPhone(user?.phoneNumber ?? '');
  }, [user?.id, user?.phoneNumber]);

  useEffect(() => {
    void syncCustomerAccountData(user).catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (!savedDeliveryLocation) {
      return;
    }

    setDeliveryAddress(savedDeliveryLocation.formattedAddress);
    setAddressSearch(savedDeliveryLocation.formattedAddress);
    setCountry(savedDeliveryLocation.country);
    setStateOrRegion(savedDeliveryLocation.stateOrRegion);
    setCity(savedDeliveryLocation.city);
    setAreaOrDistrict(savedDeliveryLocation.areaOrDistrict);
    setStreetName(savedDeliveryLocation.streetName);
    setBuildingInfo(savedDeliveryLocation.buildingInfo);
    setLandmark(savedDeliveryLocation.landmark);
    setLatitude(
      savedDeliveryLocation.latitude !== null ? String(savedDeliveryLocation.latitude) : '',
    );
    setLongitude(
      savedDeliveryLocation.longitude !== null ? String(savedDeliveryLocation.longitude) : '',
    );
    setSelectedPlaceId(savedDeliveryLocation.placeId);
    setLocationSource(savedDeliveryLocation.source);
  }, [savedDeliveryLocation?.updatedAt, savedDeliveryLocation?.userId]);

  const sellerPackingSupport = calculateSellerPackingSupport(cartTotal);
  const vat = calculateProgressiveVat(cartTotal);
  const orderTotal = cartTotal + sellerPackingSupport + vat;
  const walletBalance = user ? getAvailableAccountBalanceForUser(user) : 0;
  const insufficientFunds = paymentMethod === 'walletAccount' && Boolean(user && orderTotal > walletBalance);
  const checkoutBlocked = securitySettings.maintenanceMode || securitySettings.blockCheckout;
  const selfOwnedEntries = useMemo(
    () =>
      user ? cartEntries.filter((entry) => isBusinessOwnedByUser(entry.business, user)) : [],
    [cartEntries, isBusinessOwnedByUser, user],
  );
  const selfOwnedNames = selfOwnedEntries.map((entry) => entry.business.name);
  const individualSellerMinimumIssues = useMemo(
    () => getIndividualSellerMinimumIssues(cartEntries),
    [cartEntries],
  );
  const supportMessage = securitySettings.maintenanceMode
    ? 'Checkout is paused while the marketplace is in maintenance mode.'
    : securitySettings.blockCheckout
      ? 'Checkout is currently paused by the owner.'
      : null;
  const stockWarnings = useMemo(
    () =>
      cartEntries
        .filter((entry) => entry.quantity > getAvailableStock(entry.business.id))
        .map((entry) => entry.business.name),
    [cartEntries, getAvailableStock],
  );
  const parseCoordinate = (value: string, min: number, max: number) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const numberValue = Number(trimmedValue);
    return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
      ? numberValue
      : Number.NaN;
  };
  const currentLatitude = parseCoordinate(latitude, -90, 90);
  const currentLongitude = parseCoordinate(longitude, -180, 180);
  const typedDeliveryAddress = deliveryAddress.trim() || addressSearch.trim();
  const dispatchPhoneDigits = dispatchContactPhone.replace(/\D/g, '');
  const hasDispatchContactPhone = dispatchPhoneDigits.length >= 7;
  const isLocationError = error
    ? /address|coordinates|geocod|here|location|map|permission|pin|search|drop-?off|service/i.test(
        error,
      )
    : false;
  const showLocationEmptyState =
    hasSearchedLocation &&
    addressSearch.trim().length >= 3 &&
    !isSearchingLocation &&
    locationSuggestions.length === 0 &&
    !isLocationError &&
    !selectedPlaceId;
  const locationForPreview =
    user && typedDeliveryAddress
      ? createManualDeliveryLocation({
          userId: user.id,
          formattedAddress: typedDeliveryAddress,
          country,
          stateOrRegion,
          city,
          areaOrDistrict,
          streetName,
          buildingInfo,
          landmark,
          latitude: Number.isNaN(currentLatitude) ? null : currentLatitude,
          longitude: Number.isNaN(currentLongitude) ? null : currentLongitude,
          additionalInstructions: note,
          source: locationSource,
        })
      : undefined;
  const checkoutNote = note.trim();

  const applyDeliveryLocation = (location: DeliveryLocation) => {
    setDeliveryAddress(location.formattedAddress);
    setAddressSearch(location.formattedAddress);
    setCountry(location.country);
    setStateOrRegion(location.stateOrRegion);
    setCity(location.city);
    setAreaOrDistrict(location.areaOrDistrict);
    setStreetName(location.streetName);
    setBuildingInfo(location.buildingInfo);
    setLandmark(location.landmark);
    setLatitude(location.latitude !== null ? String(location.latitude) : '');
    setLongitude(location.longitude !== null ? String(location.longitude) : '');
    setSelectedPlaceId(location.placeId);
    setLocationSource(location.source);
    setLocationSuggestions([]);
  };

  const clearResolvedDeliveryLocation = () => {
    setDeliveryAddress('');
    setCountry('');
    setStateOrRegion('');
    setCity('');
    setAreaOrDistrict('');
    setStreetName('');
    setBuildingInfo('');
    setLandmark('');
    setLatitude('');
    setLongitude('');
    setSelectedPlaceId(undefined);
    setLocationSource('manual');
    setHasSearchedLocation(false);
  };

  const buildDeliveryLocationFromForm = () => {
    if (!user) {
      throw new Error('Sign in before saving a delivery location.');
    }

    const lat = parseCoordinate(latitude, -90, 90);
    const lng = parseCoordinate(longitude, -180, 180);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error('Latitude or longitude is invalid. Use decimal coordinates or leave them empty.');
    }

    if (!typedDeliveryAddress) {
      throw new Error('Enter or select a delivery address first.');
    }

    return {
      ...createManualDeliveryLocation({
        userId: user.id,
        formattedAddress: typedDeliveryAddress,
        country,
        stateOrRegion,
        city,
        areaOrDistrict,
        streetName,
        buildingInfo,
        landmark,
        latitude: lat,
        longitude: lng,
        additionalInstructions: note,
        source: locationSource,
      }),
      ...(selectedPlaceId ? { placeId: selectedPlaceId } : {}),
    };
  };

  const handleSearchLocation = async () => {
    const query = addressSearch.trim();
    setHasSearchedLocation(true);

    if (query.length < 3) {
      setLocationSuggestions([]);
      setError('Type at least 3 characters before searching for a drop-off location.');
      return;
    }

    try {
      setError(null);
      setLocationMessage(null);
      setIsSearchingLocation(true);
      const suggestions = await searchHereLocations(query);
      setLocationSuggestions(suggestions);
    } catch (locationError) {
      setLocationSuggestions([]);
      setError(
        locationError instanceof Error
          ? locationError.message
          : 'HERE could not load address results.',
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSelectLocationSuggestion = async (suggestion: LocationSuggestion) => {
    if (!user) {
      setError('Sign in before choosing a delivery location.');
      return;
    }

    try {
      setError(null);
      setLocationMessage(null);
      setIsSearchingLocation(true);
      const location = resolveLocationSuggestion(suggestion, user.id, note);
      applyDeliveryLocation(location);
      setLocationMessage('Address selected. Review the details, then save the delivery location.');
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : 'Unable to use that address suggestion.',
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!user) {
      setError('Sign in before pinning a delivery location.');
      return;
    }

    try {
      setError(null);
      setLocationMessage(null);
      setIsLocating(true);
      const coordinates = await requestDeviceCoordinates();
      const location = await reverseGeocodeCoordinates(coordinates, user.id, 'gps', note);
      applyDeliveryLocation(location);
      const savedLocation = await saveCustomerDeliveryLocation(user, location);
      applyDeliveryLocation(savedLocation);
      setLocationMessage('Current location pinned and saved to your account.');
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : 'Unable to read your current location.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveDeliveryLocation = async () => {
    if (!user) {
      setError('Sign in before saving a delivery location.');
      return;
    }

    try {
      setError(null);
      setLocationMessage(null);
      setIsSavingLocation(true);
      const location = buildDeliveryLocationFromForm();
      const savedLocation = await saveCustomerDeliveryLocation(user, location);
      applyDeliveryLocation(savedLocation);
      setLocationMessage('Delivery location saved to your account.');
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : 'Unable to save this delivery location.',
      );
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      setError('You need to sign in before paying.');
      return;
    }

    if (!typedDeliveryAddress) {
      setError('Add the delivery address before paying.');
      return;
    }

    if (!hasDispatchContactPhone) {
      setError('Add a valid phone number dispatch should call for this delivery.');
      return;
    }

    if (!deliveryCluster.trim()) {
      setError('Choose the delivery cluster before placing the order.');
      return;
    }

    if (stockWarnings.length > 0) {
      setError(`${stockWarnings.join(', ')} needs a quantity update before checkout.`);
      return;
    }

    if (selfOwnedEntries.length > 0) {
      setError(`${selfOwnedNames.join(', ')} is your own listing. Sellers cannot buy items they posted.`);
      return;
    }

    if (individualSellerMinimumIssues.length > 0) {
      setError(
        individualSellerMinimumIssues
          .map(
            (issue) =>
              `Add ${formatCurrency(issue.amountRemaining)} more from ${issue.sellerName}.`,
          )
          .join(' '),
      );
      return;
    }

    if (paymentMethod === 'walletAccount' && orderTotal > walletBalance) {
      setError(
        `Your portfolio balance is ${formatCurrency(walletBalance)}. Add funds before paying ${formatCurrency(orderTotal)}.`,
      );
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);
      const deliveryLocation = buildDeliveryLocationFromForm();
      const savedLocation = await saveCustomerDeliveryLocation(user, deliveryLocation);
      applyDeliveryLocation(savedLocation);
      if (paymentMethod === 'flutterwave') {
        const checkout = await startCartFlutterwaveCheckout(
          {
            deliveryAddress: savedLocation.formattedAddress,
            deliveryCluster,
            deliveryContactPhone: dispatchContactPhone.trim(),
            deliveryLocation: savedLocation,
            note: checkoutNote,
          },
          user,
          selectedFlutterwaveChannel.paymentOptions,
        );

        setActiveFlutterwaveCheckout({
          checkoutUrl: checkout.checkoutUrl,
          reference: checkout.reference,
          title: 'Order checkout',
          subtitle: `Pay ${formatCurrency(checkout.amount)} with ${selectedFlutterwaveChannel.label}.`,
          channelLabel: selectedFlutterwaveChannel.label,
        });
        return;
      }

      const order = checkoutCart(
        {
          deliveryAddress: savedLocation.formattedAddress,
          deliveryCluster,
          deliveryContactPhone: dispatchContactPhone.trim(),
          deliveryLocation: savedLocation,
          note: checkoutNote,
          paymentMethod,
        },
        user,
      );
      navigation.navigate('OrderDetails', { orderId: order.id });
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error ? checkoutError.message : 'Unable to complete payment right now.';
      setError(message);
      Alert.alert('Payment paused', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeFlutterwaveCheckout = () => {
    setActiveFlutterwaveCheckout(null);
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <Text style={styles.eyebrow}>Wallet payment</Text>
        <Text style={styles.title}>Pay immediately from your account.</Text>
        <Text style={styles.subtitle}>
          Pay through Flutterwave live checkout, or use your View2Connect account balance when it has enough funds.
        </Text>
      </View>

      {cartEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your cart is empty.</Text>
          <Text style={styles.emptyText}>
            Add products from the marketplace and they will appear here with live stock.
          </Text>
          <AppButton
            label="Back to marketplace"
            onPress={() => navigation.navigate('Dashboard')}
            variant="secondary"
          />
        </View>
      ) : (
        <>
          {supportMessage ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Checkout temporarily paused</Text>
              <Text style={styles.noticeText}>{supportMessage}</Text>
            </View>
          ) : null}

          {stockWarnings.length > 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Stock changed</Text>
              <Text style={styles.noticeText}>
                Adjust the quantities for {stockWarnings.join(', ')} before placing the order.
              </Text>
            </View>
          ) : null}

          {selfOwnedEntries.length > 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Own listing in cart</Text>
              <Text style={styles.noticeText}>
                Remove {selfOwnedNames.join(', ')} before paying. Sellers cannot buy items they posted.
              </Text>
            </View>
          ) : null}

          {individualSellerMinimumIssues.length > 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Individual seller minimum</Text>
              <Text style={styles.noticeText}>
                Each individual seller needs a subtotal of at least{' '}
                {formatCurrency(INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL)}.
              </Text>
              {individualSellerMinimumIssues.map((issue) => (
                <Text key={issue.sellerId} style={styles.noticeText}>
                  Add {formatCurrency(issue.amountRemaining)} more from {issue.sellerName}.
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Items in cart</Text>
              <Text style={styles.summaryValue}>{cartEntries.length}</Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Cart subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(cartTotal)}</Text>
            </View>
            <AppButton label="Clear cart" onPress={() => clearCart(user)} variant="ghost" />
          </View>

          <View style={styles.listStack}>
            {cartEntries.map((entry) => {
              const availableStock = getAvailableStock(entry.business.id);
              const isLowStock = availableStock <= Math.max(1, entry.business.reorderLevel ?? 0);

              return (
                <View key={entry.business.id} style={styles.cartCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.copyBlock}>
                      <Text style={styles.itemTitle}>{entry.business.name}</Text>
                      <Text style={styles.itemMeta}>
                        {entry.business.category}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {formatCurrency(entry.business.price)} each
                      </Text>
                    </View>
                    <View style={styles.amountShell}>
                      <Text style={styles.amountText}>{formatCurrency(entry.lineTotal)}</Text>
                    </View>
                  </View>

                  <View style={styles.stockRow}>
                    <View
                      style={[
                        styles.stockPill,
                        availableStock === 0 && styles.stockPillDanger,
                        availableStock > 0 && isLowStock && styles.stockPillWarning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stockText,
                          (availableStock === 0 || isLowStock) && styles.stockTextInverted,
                        ]}
                      >
                        {availableStock === 0
                          ? 'Out of stock'
                          : isLowStock
                            ? `${availableStock} left`
                            : `${availableStock} ready`}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('BusinessDetails', { businessId: entry.business.id })
                      }
                      style={({ pressed }) => [styles.inlineLink, pressed && styles.inlineLinkPressed]}
                    >
                      <Text style={styles.inlineLinkText}>Open listing</Text>
                    </Pressable>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <View style={styles.quantityRow}>
                      <Pressable
                        onPress={() => updateCartQuantity(entry.business.id, entry.quantity - 1, user)}
                        style={({ pressed }) => [
                          styles.quantityButton,
                          pressed && styles.quantityButtonPressed,
                        ]}
                      >
                        <Ionicons color={colors.primary} name="remove" size={18} />
                      </Pressable>
                      <Text style={styles.quantityValue}>{entry.quantity}</Text>
                      <Pressable
                        onPress={() => updateCartQuantity(entry.business.id, entry.quantity + 1, user)}
                        style={({ pressed }) => [
                          styles.quantityButton,
                          pressed && styles.quantityButtonPressed,
                        ]}
                      >
                        <Ionicons color={colors.primary} name="add" size={18} />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => removeFromCart(entry.business.id, user)}
                      style={({ pressed }) => [styles.removeLink, pressed && styles.removeLinkPressed]}
                    >
                      <Text style={styles.removeLinkText}>Remove item</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Delivery route</Text>
            <Text style={styles.helperText}>
              Search your drop-off point or pin your current location. The saved pin is copied to the order for dispatch.
            </Text>
            <View style={styles.routeHeader}>
              <Text style={styles.routeTitle}>Route</Text>
            </View>
            <View style={styles.routePickerCard}>
              <View style={styles.routeInputRow}>
                <View style={styles.routeDot} />
                <Text style={styles.routeInputText}>Pickup from seller</Text>
                <Ionicons color={colors.textMuted} name="storefront-outline" size={22} />
              </View>
              <View style={[styles.routeInputRow, styles.routeInputRowActive]}>
                <Ionicons color={colors.text} name="search-outline" size={22} />
                <TextInput
                  onChangeText={(value) => {
                    setAddressSearch(value);
                    clearResolvedDeliveryLocation();
                    setError(null);
                    setLocationMessage(null);
                  }}
                  placeholder="Dropoff location"
                  placeholderTextColor={colors.textMuted}
                  style={styles.routeSearchInput}
                  value={addressSearch}
                />
                <Pressable
                  accessibilityLabel="Pin my current location"
                  onPress={() => void handleUseCurrentLocation()}
                  style={({ pressed }) => [styles.routePinButton, pressed && styles.inlineLinkPressed]}
                >
                  <Ionicons
                    color={colors.primary}
                    name={isLocating ? 'hourglass-outline' : 'map-outline'}
                    size={22}
                  />
                </Pressable>
              </View>
            </View>
            <Text style={styles.dropoffInstructionText}>
              Type your estate, street, landmark, or full address, then tap Search location
              and choose the closest result. If you are already at the delivery point, tap
              the map icon to pin your exact GPS location for dispatch.
            </Text>
            <View style={styles.locationActionRow}>
              <AppButton
                label={isSearchingLocation ? 'Searching...' : 'Search location'}
                loading={isSearchingLocation}
                onPress={() => void handleSearchLocation()}
                variant="secondary"
              />
            </View>
            {isLocationError ? (
              <View style={styles.locationErrorBox}>
                <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {isSearchingLocation ? (
              <Text style={styles.locationText}>Searching HERE...</Text>
            ) : null}
            {locationSuggestions.length > 0 ? (
              <View style={styles.suggestionsCard}>
                {locationSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion.id}
                    onPress={() => void handleSelectLocationSuggestion(suggestion)}
                    style={({ pressed }) => [
                      styles.suggestionRow,
                      pressed && styles.suggestionRowPressed,
                    ]}
                  >
                    <View style={styles.suggestionIcon}>
                      <Ionicons
                        color={colors.textMuted}
                        name={index % 2 === 0 ? 'time-outline' : 'business-outline'}
                        size={20}
                      />
                    </View>
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                      <Text style={styles.suggestionSubtitle}>
                        {suggestion.subtitle || suggestion.description}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {showLocationEmptyState ? (
              <Text style={styles.locationText}>
                No matching address found. Try a fuller address, street, estate, landmark, city, or state.
              </Text>
            ) : null}
            <Text style={styles.mapAttribution}>Powered by HERE Technologies</Text>
            <Text style={styles.detailSectionTitle}>Saved drop-off for dispatch</Text>
            {locationForPreview ? (
              <Pressable
                onPress={() => {
                  if (locationForPreview) {
                    void Linking.openURL(googleMapsSearchUrl(locationForPreview));
                  }
                }}
                style={({ pressed }) => [styles.mapPreviewCard, pressed && styles.inlineLinkPressed]}
              >
                <View style={styles.mapPinSummary}>
                  <Ionicons color={colors.primary} name="location-outline" size={28} />
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionTitle}>{typedDeliveryAddress}</Text>
                    <Text style={styles.suggestionSubtitle}>
                      {currentLatitude !== null &&
                      currentLongitude !== null &&
                      !Number.isNaN(currentLatitude) &&
                      !Number.isNaN(currentLongitude)
                        ? 'Exact GPS pin saved for dispatch.'
                        : 'Select a suggestion or use the pin icon for exact GPS coordinates.'}
                    </Text>
                  </View>
                </View>
                <View style={styles.mapPreviewFooter}>
                  <Ionicons color={colors.primary} name="navigate-outline" size={17} />
                  <Text style={styles.inlineLinkText}>Open drop-off in maps</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Ionicons color={colors.textMuted} name="map-outline" size={28} />
                <Text style={styles.locationText}>
                  Select a drop-off suggestion or tap the pin icon to save the buyer location for dispatch.
                </Text>
              </View>
            )}

            <FormField
              helper="Required before payment. This is the number the dispatch rider will call for this order."
              keyboardType="phone-pad"
              label="Phone number for dispatch"
              onChangeText={(value) => {
                setDispatchContactPhone(value);
                setError(null);
              }}
              placeholder="08012345678"
              value={dispatchContactPhone}
            />

            <FormField
              helper="Saved with the delivery location and copied to the order."
              label="Additional delivery instructions"
              multiline
              onChangeText={(value) => {
                setNote(value);
                setError(null);
              }}
              placeholder="Call on arrival and leave with security if unavailable."
              value={note}
            />
            <AppButton
              label="Save delivery location"
              loading={isSavingLocation}
              onPress={() => void handleSaveDeliveryLocation()}
              variant="secondary"
            />
            {locationMessage ? <Text style={styles.successText}>{locationMessage}</Text> : null}
          </View>

          <View style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Payment account</Text>
            <View style={styles.paymentWrap}>
              {launchPaymentMethods.map((method) => {
                const isActive = method === paymentMethod;
                const methodCopy =
                  method === 'flutterwave'
                    ? 'Open Flutterwave to pay with card or bank transfer.'
                    : 'Use your View2Connect account balance to pay now.';

                return (
                  <Pressable
                    key={method}
                    onPress={() => {
                      setPaymentMethod(method);
                      setError(null);
                    }}
                    style={({ pressed }) => [
                      styles.paymentCard,
                      isActive && styles.paymentCardActive,
                      pressed && styles.paymentCardPressed,
                    ]}
                  >
                    <Text style={[styles.paymentTitle, isActive && styles.paymentTitleActive]}>
                      {getPaymentMethodLabel(method)}
                    </Text>
                    <Text style={[styles.paymentMeta, isActive && styles.paymentMetaActive]}>
                      {methodCopy} Seller money remains pending until customer care verifies warehouse arrival.
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {paymentMethod === 'flutterwave' ? (
              <View style={styles.flutterwaveChannelGrid}>
                {flutterwaveChannels.map((channel) => {
                  const isActive = channel.id === flutterwaveChannel;

                  return (
                    <Pressable
                      key={channel.id}
                      onPress={() => {
                        setFlutterwaveChannel(channel.id);
                        setError(null);
                      }}
                      style={({ pressed }) => [
                        styles.flutterwaveChannelChip,
                        isActive && styles.flutterwaveChannelChipActive,
                        pressed && styles.flutterwaveChannelChipPressed,
                      ]}
                    >
                      <Ionicons
                        color={isActive ? colors.white : colors.primary}
                        name={channel.icon}
                        size={18}
                      />
                      <Text
                        style={[
                          styles.flutterwaveChannelTitle,
                          isActive && styles.flutterwaveChannelTitleActive,
                        ]}
                      >
                        {channel.label}
                      </Text>
                      <Text
                        style={[
                          styles.flutterwaveChannelMeta,
                          isActive && styles.flutterwaveChannelMetaActive,
                        ]}
                      >
                        {channel.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Order summary</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Order Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(cartTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Seller Packing Support</Text>
              <Text style={styles.totalValue}>{formatCurrency(sellerPackingSupport)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT</Text>
              <Text style={styles.totalValue}>{formatCurrency(vat)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowStrong]}>
              <Text style={styles.totalLabelStrong}>Total Amount</Text>
              <Text style={styles.totalValueStrong}>{formatCurrency(orderTotal)}</Text>
            </View>

            {insufficientFunds ? (
              <Text style={styles.errorText}>
                Add funds to your portfolio before paying this order.
              </Text>
            ) : null}
            {!hasDispatchContactPhone ? (
              <Text style={styles.errorText}>
                Enter a valid dispatch contact number before payment can continue.
              </Text>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.actionStack}>
              <AppButton
                disabled={
                  checkoutBlocked ||
                  stockWarnings.length > 0 ||
                  insufficientFunds ||
                  !hasDispatchContactPhone ||
                  selfOwnedEntries.length > 0 ||
                  individualSellerMinimumIssues.length > 0
                }
                label="Pay immediately"
                loading={isSubmitting}
                onPress={() => void handleCheckout()}
              />
              <AppButton
                label="Continue shopping"
                onPress={() => navigation.navigate('Dashboard')}
                variant="secondary"
              />
              <AppButton label="Back" onPress={() => navigation.goBack()} variant="ghost" />
            </View>
          </View>
        </>
      )}
    </ScrollView>
    {activeFlutterwaveCheckout ? (
      <FlutterwaveCheckoutModal
        key={activeFlutterwaveCheckout.checkoutUrl}
        activePaymentLabel={activeFlutterwaveCheckout.channelLabel}
        checkoutUrl={activeFlutterwaveCheckout.checkoutUrl}
        onClose={closeFlutterwaveCheckout}
        reference={activeFlutterwaveCheckout.reference}
        subtitle={activeFlutterwaveCheckout.subtitle}
        title={activeFlutterwaveCheckout.title}
        visible
      />
    ) : null}
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
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
    heroGlowOne: {
      position: 'absolute',
      top: -32,
      right: -8,
      height: 138,
      width: 138,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.28)',
    },
    heroGlowTwo: {
      position: 'absolute',
      bottom: -44,
      left: -18,
      height: 160,
      width: 160,
      borderRadius: 999,
      backgroundColor: 'rgba(58, 144, 158, 0.24)',
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
      maxWidth: 720,
    },
    emptyState: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.soft,
    },
    emptyTitle: {
      ...typography.section,
      color: colors.text,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    noticeCard: {
      gap: spacing.xs,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    noticeTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    noticeText: {
      ...typography.body,
      color: colors.textMuted,
    },
    summaryCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.primarySoft,
      padding: spacing.lg,
      ...shadows.soft,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.primary,
    },
    summaryValue: {
      ...typography.title,
      color: colors.primary,
    },
    listStack: {
      gap: spacing.md,
    },
    cartCard: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    cardTopRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    copyBlock: {
      flex: 1,
      gap: 4,
      minWidth: 220,
    },
    itemTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    itemMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    amountShell: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    amountText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    stockRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    stockPill: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    stockPillWarning: {
      backgroundColor: '#7A7A7A',
    },
    stockPillDanger: {
      backgroundColor: colors.danger,
    },
    stockText: {
      ...typography.caption,
      color: colors.primary,
    },
    stockTextInverted: {
      color: colors.white,
    },
    inlineLink: {
      alignSelf: 'flex-start',
    },
    inlineLinkPressed: {
      opacity: 0.82,
    },
    inlineLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    cardBottomRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    quantityButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      width: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quantityButtonPressed: {
      opacity: 0.92,
    },
    quantityValue: {
      ...typography.bodyStrong,
      color: colors.text,
      minWidth: 24,
      textAlign: 'center',
    },
    removeLink: {
      alignSelf: 'flex-start',
    },
    removeLinkPressed: {
      opacity: 0.82,
    },
    removeLinkText: {
      ...typography.bodyStrong,
      color: colors.danger,
    },
    checkoutCard: {
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
    helperText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    routeHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xs,
    },
    routeTitle: {
      ...typography.bodyStrong,
      color: colors.text,
      fontWeight: '800',
    },
    routePickerCard: {
      gap: 0,
      overflow: 'hidden',
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    routeInputRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    routeInputRowActive: {
      borderWidth: 1,
      borderColor: colors.success,
      borderBottomWidth: 1,
      backgroundColor: colors.surface,
    },
    routeDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 3,
      borderColor: colors.primarySoft,
      backgroundColor: colors.primary,
    },
    routeInputText: {
      flex: 1,
      ...typography.body,
      color: colors.text,
    },
    routeSearchInput: {
      flex: 1,
      minWidth: 0,
      ...typography.body,
      color: colors.text,
      paddingVertical: spacing.sm,
    },
    routePinButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchShell: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      ...typography.body,
      color: colors.text,
      paddingVertical: spacing.sm,
    },
    suggestionsCard: {
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    locationErrorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: spacing.md,
    },
    suggestionRowPressed: {
      opacity: 0.88,
      backgroundColor: colors.primarySoft,
    },
    suggestionIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
    },
    suggestionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    suggestionTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    suggestionSubtitle: {
      ...typography.caption,
      color: colors.textMuted,
    },
    detailSectionTitle: {
      ...typography.bodyStrong,
      color: colors.text,
      marginTop: spacing.sm,
    },
    formGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    mapPreviewCard: {
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    mapPinSummary: {
      minHeight: 118,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    mapPreviewFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.md,
    },
    mapPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 150,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.lg,
    },
    clusterWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    locationActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    locationText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    dropoffInstructionText: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
    },
    mapAttribution: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'right',
    },
    successText: {
      ...typography.bodyStrong,
      color: colors.success,
    },
    clusterChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    clusterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    clusterChipPressed: {
      opacity: 0.92,
    },
    clusterChipText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    clusterChipTextActive: {
      color: colors.white,
    },
    paymentWrap: {
      gap: spacing.sm,
    },
    paymentCard: {
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    paymentCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    paymentCardPressed: {
      opacity: 0.92,
    },
    paymentTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    paymentTitleActive: {
      color: colors.primary,
    },
    paymentMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    paymentMetaActive: {
      color: colors.primary,
    },
    flutterwaveChannelGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    flutterwaveChannelChip: {
      flex: 1,
      minWidth: 112,
      minHeight: 92,
      justifyContent: 'center',
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    flutterwaveChannelChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    flutterwaveChannelChipPressed: {
      opacity: 0.92,
    },
    flutterwaveChannelTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    flutterwaveChannelTitleActive: {
      color: colors.white,
    },
    flutterwaveChannelMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    flutterwaveChannelMetaActive: {
      color: colors.white,
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
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    actionStack: {
      gap: spacing.sm,
    },
  });
}
