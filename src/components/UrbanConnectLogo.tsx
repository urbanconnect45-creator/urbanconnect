import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../theme';
import { spacing, typography } from '../theme';
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
        <Ionicons color={colors.white} name="bag-handle-outline" size={compact ? 25 : 27} />
        <Text style={styles.markText}>2</Text>
        <View style={styles.routeDot} />
      </View>
      {compact ? null : (
        <View style={styles.copy}>
          <Text style={styles.name}>View2Connect</Text>
          <Text style={styles.tagline}>Buy. Sell. Connect.</Text>
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
      backgroundColor: inverted ? '#211144' : '#5B2BCB',
      borderWidth: 1,
      borderColor: inverted ? 'rgba(255,255,255,0.2)' : '#D8CBF7',
    },
    markText: {
      ...typography.caption,
      position: 'absolute',
      top: 6,
      right: 7,
      color: colors.white,
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '800',
    },
    routeDot: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      height: 10,
      width: 10,
      borderRadius: 5,
      backgroundColor: '#F06038',
      borderWidth: 2,
      borderColor: inverted ? '#211144' : '#5B2BCB',
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
