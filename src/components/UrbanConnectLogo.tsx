import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../theme';
import { radii, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type UrbanConnectLogoProps = {
  compact?: boolean;
  inverted?: boolean;
};

export function UrbanConnectLogo({ compact = false, inverted = false }: UrbanConnectLogoProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, inverted);

  return (
    <View style={styles.logoShell}>
      <View style={styles.mark}>
        <View style={styles.markAccent} />
        <Text style={styles.markText}>UC</Text>
        <Ionicons color={colors.white} name="location" size={compact ? 11 : 12} style={styles.markPin} />
        <View style={styles.routeDot} />
      </View>
      {compact ? null : (
        <View style={styles.copy}>
          <Text style={styles.name}>UrbanConnect</Text>
          <Text style={styles.tagline}>River Park marketplace</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: AppColors, inverted: boolean) {
  return StyleSheet.create({
    logoShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    mark: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      width: 48,
      borderRadius: 16,
      backgroundColor: inverted ? '#2B2B2B' : colors.primary,
      borderWidth: 1,
      borderColor: inverted ? 'rgba(255,255,255,0.18)' : colors.primarySoft,
    },
    markAccent: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 9,
      height: 11,
      borderRadius: radii.pill,
      backgroundColor: inverted ? colors.primary : colors.secondary,
    },
    markText: {
      ...typography.bodyStrong,
      color: colors.white,
      fontSize: 17,
      lineHeight: 22,
    },
    markPin: {
      position: 'absolute',
      top: 7,
      right: 8,
    },
    routeDot: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      height: 10,
      width: 10,
      borderRadius: 5,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: inverted ? '#2B2B2B' : colors.primary,
    },
    copy: {
      gap: 1,
    },
    name: {
      ...typography.bodyStrong,
      color: inverted ? colors.white : colors.text,
    },
    tagline: {
      ...typography.caption,
      color: inverted ? '#B9B9B9' : colors.textMuted,
    },
  });
}
