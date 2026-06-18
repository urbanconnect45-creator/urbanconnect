import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  variant = 'primary',
}: AppButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary : colors.white} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'ghost' && styles.ghostLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    base: {
      minHeight: 56,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
    },
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      ...shadows.soft,
    },
    secondary: {
      backgroundColor: colors.secondary,
      borderColor: colors.secondary,
      ...shadows.soft,
    },
    ghost: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    pressed: {
      transform: [{ translateY: 1 }, { scale: 0.995 }],
    },
    disabled: {
      opacity: 0.6,
    },
    label: {
      ...typography.bodyStrong,
      letterSpacing: 0.2,
    },
    primaryLabel: {
      color: colors.white,
    },
    secondaryLabel: {
      color: colors.white,
    },
    ghostLabel: {
      color: colors.primary,
    },
  });
}
