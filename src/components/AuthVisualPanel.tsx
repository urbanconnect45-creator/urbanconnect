import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../theme';
import { spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { UrbanConnectLogo } from './UrbanConnectLogo';

const marketplaceImage = require('../../assets/seller-registration-marketplace.png');

type AuthVisualPanelProps = {
  title: string;
  subtitle: string;
  wide: boolean;
};

export function AuthVisualPanel({ title, subtitle, wide }: AuthVisualPanelProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <ImageBackground
      imageStyle={styles.panelImage}
      resizeMode="cover"
      source={marketplaceImage}
      style={[styles.panel, wide && styles.panelWide]}
    >
      <View style={styles.overlay} />
      <View style={styles.brandRow}>
        <UrbanConnectLogo inverted />
        <View style={styles.cacBadge}>
          <Ionicons color={colors.white} name="shield-checkmark-outline" size={17} />
          <Text style={styles.cacText}>CAC registered</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Buy. Sell. Connect.</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </ImageBackground>
  );
}

function createStyles(colors: AppColors) {
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
      backgroundColor: 'rgba(30, 15, 61, 0.72)',
    },
    brandRow: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    cacBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      borderRadius: 8,
      backgroundColor: 'rgba(20,12,37,0.56)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    cacText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    copy: {
      position: 'relative',
      maxWidth: 650,
      gap: spacing.sm,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#F2C45A',
    },
    title: {
      ...typography.title,
      color: colors.white,
      fontSize: 36,
      lineHeight: 43,
    },
    subtitle: {
      ...typography.body,
      color: '#F1ECFA',
      maxWidth: 580,
    },
  });
}
