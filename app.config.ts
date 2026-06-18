import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'UrbanConnect',
  slug: 'urbanconnect',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'urbanconnect',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.urbanconnect.app',
    supportsTablet: true,
    infoPlist: {
      NSFaceIDUsageDescription:
        'Allow UrbanConnect to use Face ID to unlock your account securely.',
    },
  },
  android: {
    package: 'com.urbanconnect.app',
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Allow UrbanConnect to use Face ID to unlock your account securely.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow UrbanConnect to access your photos and videos so you can upload listing media from the gallery.',
      },
    ],
  ],
});
