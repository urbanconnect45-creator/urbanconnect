import { Platform } from 'react-native';

import { readPublicEnv } from '../config/runtime';
import type { DeliveryLocation, DeliveryLocationSource } from '../types/business';

type HereAddress = {
  label?: string;
  countryName?: string;
  state?: string;
  county?: string;
  city?: string;
  district?: string;
  street?: string;
  houseNumber?: string;
};

type HereItem = {
  id?: string;
  title?: string;
  resultType?: string;
  address?: HereAddress;
  position?: {
    lat?: number;
    lng?: number;
  };
  access?: Array<{
    lat?: number;
    lng?: number;
  }>;
};

type HereResponse = {
  items?: HereItem[];
  title?: string;
  status?: number;
  cause?: string;
  action?: string;
};

export type LocationSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  placeId: string;
  latitude: number;
  longitude: number;
  address?: HereAddress;
};

export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
};

const hereApiKey = readPublicEnv('EXPO_PUBLIC_HERE_API_KEY') ?? '';
const hereSearchBaseUrl = 'https://geocode.search.hereapi.com/v1';
const hereDiscoverBaseUrl = 'https://discover.search.hereapi.com/v1';
const hereCountryFilter = 'countryCode:NGA';
const defaultNigeriaSearchCenter: DeviceCoordinates = {
  latitude: 9.0765,
  longitude: 7.3986,
};

type DeliveryLocationMappingOptions = {
  fallbackCoordinates?: DeviceCoordinates;
  forceCoordinates?: DeviceCoordinates;
  formattedAddress?: string;
};

function requireHereApiKey() {
  if (!hereApiKey.trim()) {
    throw new Error('HERE API key is not configured. Add EXPO_PUBLIC_HERE_API_KEY.');
  }

  return hereApiKey.trim();
}

function firstAvailable(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? '';
}

function splitDisplayName(displayName = '') {
  const parts = displayName.split(',').map((part) => part.trim()).filter(Boolean);

  return {
    title: parts[0] ?? displayName,
    subtitle: parts.slice(1, 4).join(', '),
  };
}

function fallbackPinnedAddress(coordinates: DeviceCoordinates) {
  return `Pinned location (${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)})`;
}

async function fetchHereJson(url: URL, fallbackMessage: string) {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => undefined) as HereResponse | undefined;

  if (!response.ok) {
    throw new Error(payload?.title || payload?.cause || payload?.action || fallbackMessage);
  }

  return payload ?? {};
}

function itemCoordinates(item: HereItem) {
  const accessPoint = item.access?.[0];
  const latitude = accessPoint?.lat ?? item.position?.lat;
  const longitude = accessPoint?.lng ?? item.position?.lng;

  return {
    latitude: typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null,
    longitude: typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null,
  };
}

function itemFormattedAddress(item: HereItem, coordinates?: DeviceCoordinates) {
  return (
    firstAvailable(item.address?.label, item.title) ||
    (coordinates ? fallbackPinnedAddress(coordinates) : '')
  );
}

function pinnedFormattedAddress(item: HereItem, coordinates: DeviceCoordinates) {
  const nearestAddress = firstAvailable(item.address?.label, item.title);

  return nearestAddress
    ? `Pinned current location near ${nearestAddress}`
    : fallbackPinnedAddress(coordinates);
}

function itemToDeliveryLocation(
  item: HereItem,
  userId: string,
  source: DeliveryLocationSource,
  additionalInstructions = '',
  options: DeliveryLocationMappingOptions = {},
): DeliveryLocation {
  const coordinates = itemCoordinates(item);
  const latitude =
    options.forceCoordinates?.latitude ?? coordinates.latitude ?? options.fallbackCoordinates?.latitude ?? null;
  const longitude =
    options.forceCoordinates?.longitude ?? coordinates.longitude ?? options.fallbackCoordinates?.longitude ?? null;
  const address = item.address ?? {};
  const formattedAddress = firstAvailable(
    options.formattedAddress,
    itemFormattedAddress(
      item,
      latitude !== null && longitude !== null
        ? { latitude, longitude }
        : options.fallbackCoordinates,
    ),
  );
  const placeId = firstAvailable(item.id);

  return {
    userId,
    formattedAddress,
    country: firstAvailable(address.countryName),
    stateOrRegion: firstAvailable(address.state, address.county),
    city: firstAvailable(address.city),
    areaOrDistrict: firstAvailable(address.district, address.county),
    streetName: firstAvailable(address.street),
    buildingInfo: firstAvailable(address.houseNumber),
    landmark: item.resultType === 'place' ? firstAvailable(item.title) : '',
    latitude,
    longitude,
    additionalInstructions,
    ...(placeId ? { placeId } : {}),
    source,
    updatedAt: new Date().toISOString(),
  };
}

function suggestionToItem(suggestion: LocationSuggestion): HereItem {
  return {
    id: suggestion.placeId,
    title: suggestion.title,
    address: suggestion.address ?? {
      label: suggestion.description,
    },
    position: {
      lat: suggestion.latitude,
      lng: suggestion.longitude,
    },
  };
}

export function createManualDeliveryLocation(params: {
  userId: string;
  formattedAddress: string;
  country?: string;
  stateOrRegion?: string;
  city?: string;
  areaOrDistrict?: string;
  streetName?: string;
  buildingInfo?: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  additionalInstructions?: string;
  source?: DeliveryLocationSource;
}): DeliveryLocation {
  return {
    userId: params.userId,
    formattedAddress: params.formattedAddress.trim(),
    country: params.country?.trim() ?? '',
    stateOrRegion: params.stateOrRegion?.trim() ?? '',
    city: params.city?.trim() ?? '',
    areaOrDistrict: params.areaOrDistrict?.trim() ?? '',
    streetName: params.streetName?.trim() ?? '',
    buildingInfo: params.buildingInfo?.trim() ?? '',
    landmark: params.landmark?.trim() ?? '',
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
    additionalInstructions: params.additionalInstructions?.trim() ?? '',
    source: params.source ?? 'manual',
    updatedAt: new Date().toISOString(),
  };
}

export async function searchHereLocations(input: string): Promise<LocationSuggestion[]> {
  const query = input.trim();

  if (query.length < 3) {
    return [];
  }

  const apiKey = requireHereApiKey();
  const [discoverResult, geocodeResult] = await Promise.allSettled([
    fetchHereDiscoverSuggestions(query, apiKey),
    fetchHereGeocodeSuggestions(query, apiKey),
  ]);
  const suggestions = uniqueLocationSuggestions([
    ...(discoverResult.status === 'fulfilled' ? discoverResult.value : []),
    ...(geocodeResult.status === 'fulfilled' ? geocodeResult.value : []),
  ]);

  if (suggestions.length > 0) {
    return suggestions.slice(0, 6);
  }

  if (discoverResult.status === 'rejected') {
    throw discoverResult.reason instanceof Error
      ? discoverResult.reason
      : new Error('HERE could not load place results.');
  }

  if (geocodeResult.status === 'rejected') {
    throw geocodeResult.reason instanceof Error
      ? geocodeResult.reason
      : new Error('HERE could not load address results.');
  }

  return [];
}

function itemToLocationSuggestion(item: HereItem): LocationSuggestion | undefined {
  const coordinates = itemCoordinates(item);

  if (coordinates.latitude === null || coordinates.longitude === null) {
    return undefined;
  }

  const description = itemFormattedAddress(item, {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  });
  const displayParts = splitDisplayName(description);
  const title = firstAvailable(item.title, displayParts.title, description);
  const placeId = firstAvailable(
    item.id,
    `${coordinates.latitude},${coordinates.longitude}`,
  );

  return {
    id: placeId,
    title,
    subtitle: displayParts.subtitle,
    description,
    placeId,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    ...(item.address ? { address: item.address } : {}),
  };
}

function uniqueLocationSuggestions(suggestions: LocationSuggestion[]) {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.placeId,
      suggestion.title.toLowerCase(),
      suggestion.latitude.toFixed(5),
      suggestion.longitude.toFixed(5),
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchHereGeocodeSuggestions(query: string, apiKey: string) {
  const url = new URL(`${hereSearchBaseUrl}/geocode`);
  url.searchParams.set('q', query);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('limit', '6');
  url.searchParams.set('in', hereCountryFilter);

  const payload = await fetchHereJson(url, 'HERE could not load address results.');

  return (payload.items ?? [])
    .map(itemToLocationSuggestion)
    .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion));
}

async function fetchHereDiscoverSuggestions(query: string, apiKey: string) {
  const url = new URL(`${hereDiscoverBaseUrl}/discover`);
  url.searchParams.set('q', query);
  url.searchParams.set(
    'at',
    `${defaultNigeriaSearchCenter.latitude},${defaultNigeriaSearchCenter.longitude}`,
  );
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('limit', '6');
  url.searchParams.set('in', hereCountryFilter);

  const payload = await fetchHereJson(url, 'HERE could not load place results.');

  return (payload.items ?? [])
    .map(itemToLocationSuggestion)
    .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion));
}

export function resolveLocationSuggestion(
  suggestion: LocationSuggestion,
  userId: string,
  additionalInstructions = '',
) {
  return itemToDeliveryLocation(
    suggestionToItem(suggestion),
    userId,
    'search',
    additionalInstructions,
  );
}

export async function reverseGeocodeCoordinates(
  coordinates: DeviceCoordinates,
  userId: string,
  source: DeliveryLocationSource = 'gps',
  additionalInstructions = '',
) {
  try {
    const url = new URL(`${hereSearchBaseUrl}/revgeocode`);
    url.searchParams.set('at', `${coordinates.latitude},${coordinates.longitude}`);
    url.searchParams.set('apiKey', requireHereApiKey());
    url.searchParams.set('lang', 'en');
    url.searchParams.set('limit', '1');

    const payload = await fetchHereJson(url, 'HERE could not convert this pin to an address.');
    const item = payload.items?.[0];

    if (item) {
      return itemToDeliveryLocation(item, userId, source, additionalInstructions, {
        fallbackCoordinates: coordinates,
        forceCoordinates: coordinates,
        formattedAddress: pinnedFormattedAddress(item, coordinates),
      });
    }
  } catch {
    // The GPS pin is still useful for dispatch even when reverse lookup is unavailable.
  }

  return createManualDeliveryLocation({
    userId,
    formattedAddress: fallbackPinnedAddress(coordinates),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    additionalInstructions,
    source,
  });
}

export async function requestDeviceCoordinates(): Promise<DeviceCoordinates> {
  if (Platform.OS !== 'web') {
    let ExpoLocation: typeof import('expo-location');

    try {
      ExpoLocation = await import('expo-location');
    } catch {
      throw new Error(
        'Location is not available in this native build yet. Rebuild the Expo development app after installing expo-location, or search/type the address manually.',
      );
    }

    const permission = await ExpoLocation.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      throw new Error('Location permission was denied. Search or type your address instead.');
    }

    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  const geolocation = globalThis.navigator?.geolocation;

  if (!geolocation) {
    throw new Error('Current location is not available in this browser. Search or type your address instead.');
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(error.message || 'Location permission was denied. Search or type your address instead.'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 15000,
      },
    );
  });
}

export function googleMapsSearchUrl(location: DeliveryLocation) {
  if (location.latitude !== null && location.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.formattedAddress)}`;
}
