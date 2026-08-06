import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'View2Connect',
  slug: 'urbanconnect',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'urbanconnect',
  userInterfaceStyle: 'light',

  extra: {
    eas: {
      projectId: '3cfa24a8-5a29-4392-afaf-2696ed97b87d',
    },
  },

  ios: {
    bundleIdentifier: 'com.view2connect.ng',
    supportsTablet: true,
    infoPlist: {
      NSFaceIDUsageDescription:
        'Allow View2Connect to use Face ID to unlock your account securely.',
    },
  },
  android: {
    package: 'com.view2connect.ng',
    intentFilters: [
      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            scheme: 'urbanconnect',
            host: 'auth',
            pathPrefix: '/callback',
          },
        ],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-font',
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Allow View2Connect to use Face ID to unlock your account securely.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow View2Connect to access your photos and videos so you can upload listing media from the gallery.',
      },
    ],
  ],
});
