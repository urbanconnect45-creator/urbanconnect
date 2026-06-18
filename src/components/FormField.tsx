import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string | undefined;
  helper?: string | undefined;
};

export function FormField({ label, error, helper, multiline, style, ...props }: FormFieldProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.multilineInput, error && styles.inputError, style]}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      ...typography.caption,
      color: colors.text,
      letterSpacing: 0.3,
    },
    input: {
      minHeight: 58,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...typography.body,
      ...shadows.soft,
    },
    multilineInput: {
      minHeight: 132,
      paddingVertical: spacing.md,
    },
    inputError: {
      borderColor: colors.danger,
    },
    helper: {
      ...typography.caption,
      color: colors.textMuted,
    },
    error: {
      ...typography.caption,
      color: colors.danger,
    },
  });
}
