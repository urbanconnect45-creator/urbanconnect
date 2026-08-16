import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../theme';
import { spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { UrbanConnectLogo } from './UrbanConnectLogo';

const marketplaceImage = require('../../assets/journey/auth-customer.png');

type AuthVisualPanelProps = {
  roleLabel?: string;
  title: string;
  subtitle: string;
  wide: boolean;
};

export function AuthVisualPanel({ roleLabel = 'Customer', title, subtitle, wide }: AuthVisualPanelProps) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors, isDarkMode);

  return (
    <ImageBackground
      accessibilityLabel={`${title}. ${subtitle}`}
      imageStyle={styles.panelImage}
      resizeMode="cover"
      source={marketplaceImage}
      style={[styles.panel, wide && styles.panelWide]}
    >
      <View style={styles.overlay} />
      <View style={styles.brandRow}>
        <UrbanConnectLogo inverted />
        <View style={styles.roleDivider} />
        <Text style={styles.roleText}>{roleLabel}</Text>
      </View>
      <View style={styles.copy}><Text style={styles.subtitle}>Buy. Sell. Deliver. Connect locally.</Text></View>
    </ImageBackground>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean) {
  return StyleSheet.create({
    panel: {
      minHeight: 280,
      position: 'relative',
      overflow: 'hidden',
      justifyContent: 'space-between',
      padding: spacing.xl,
    },
    panelWide: {
      flex: 1,
      minWidth: 0,
      minHeight: '100%',
      height: '100%',
      padding: spacing.xxl,
    },
    panelImage: {
      width: '100%',
      height: '100%',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(12, 5, 25, 0.12)' : 'rgba(23, 8, 47, 0.18)',
    },
    brandRow: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.md,
    },
    roleDivider: {
      width: 1,
      height: 28,
      backgroundColor: 'rgba(255,255,255,0.42)',
    },
    roleText: {
      ...typography.body,
      color: colors.white,
    },
    copy: {
      position: 'relative',
      maxWidth: 420,
    },
    subtitle: {
      ...typography.body,
      color: '#F1ECFA',
      fontWeight: '700',
    },
  });
}
