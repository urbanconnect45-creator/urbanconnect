import type { ReactNode } from 'react';
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import type { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

const marketplaceBackground = require('../../assets/seller-registration-marketplace.png');

type AuthPageBackgroundProps = {
  children: ReactNode;
  contentContainerStyle: StyleProp<ViewStyle>;
  minimalMobile?: boolean;
};

export function AuthPageBackground({
  children,
  contentContainerStyle,
  minimalMobile = false,
}: AuthPageBackgroundProps) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors, isDarkMode);

  if (minimalMobile) {
    return (
      <View style={styles.minimalBackground}>
        <ScrollView
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <ImageBackground
      resizeMode="cover"
      source={marketplaceBackground}
      style={styles.background}
    >
      <View pointerEvents="none" style={styles.dim} />
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {children}
      </ScrollView>
    </ImageBackground>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean) {
  return StyleSheet.create({
    background: {
      flex: 1,
      width: '100%',
      height: Platform.OS === 'web' ? ('100vh' as never) : undefined,
      minHeight: Platform.OS === 'web' ? ('100vh' as never) : undefined,
      backgroundColor: isDarkMode ? '#100B19' : '#160F25',
    },
    minimalBackground: {
      flex: 1,
      backgroundColor: isDarkMode ? '#100B19' : colors.background,
    },
    dim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(10, 6, 18, 0.86)' : 'rgba(20, 12, 37, 0.76)',
    },
    scroll: {
      flex: 1,
    },
  });
}
