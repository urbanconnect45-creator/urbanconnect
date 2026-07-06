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

const marketplaceBackground = require('../../assets/seller-registration-marketplace.png');

type AuthPageBackgroundProps = {
  children: ReactNode;
  contentContainerStyle: StyleProp<ViewStyle>;
};

export function AuthPageBackground({
  children,
  contentContainerStyle,
}: AuthPageBackgroundProps) {
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

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: Platform.OS === 'web' ? ('100vh' as never) : undefined,
    minHeight: Platform.OS === 'web' ? ('100vh' as never) : undefined,
    backgroundColor: '#160F25',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 12, 37, 0.76)',
  },
  scroll: {
    flex: 1,
  },
});
