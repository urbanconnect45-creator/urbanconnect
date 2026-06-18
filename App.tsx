import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppBackdrop } from './src/components/AppBackdrop';
import { AuthProvider } from './src/hooks/useAuth';
import { BusinessDirectoryProvider } from './src/hooks/useBusinessDirectory';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';
import { colors } from './src/theme';

function AppFrame() {
  const { colors: themeColors, isDarkMode } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <AppBackdrop />
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
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppFrame />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
