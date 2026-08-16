import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppBackdrop } from './src/components/AppBackdrop';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { AuthProvider } from './src/hooks/useAuth';
import { BusinessDirectoryProvider } from './src/hooks/useBusinessDirectory';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';
import { colors } from './src/theme';

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

function AppFrame() {
  const { colors: themeColors, isDarkMode } = useAppTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const existing = document.querySelector('meta[name="viewport"]');

        const content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0';

        if (existing) {
          existing.setAttribute('content', content);
        } else {
          const m = document.createElement('meta');
          m.name = 'viewport';
          m.content = content;
          document.head.appendChild(m);
        }
      } catch {
        // ignore errors manipulating the document
      }
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      {Platform.OS === 'web' ? <AppBackdrop /> : null}
      <BusinessDirectoryProvider>
        <AuthProvider>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={styles.appFrame}>
            <AppNavigator />
          </View>
        </AuthProvider>
      </BusinessDirectoryProvider>
    </View>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppFrame />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appFrame: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
});
