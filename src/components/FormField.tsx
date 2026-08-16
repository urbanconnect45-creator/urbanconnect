import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import type { ReactNode } from 'react';

import type { AppColors } from '../theme';
import { shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string | undefined;
  helper?: string | undefined;
  rightAccessory?: ReactNode;
};

export function FormField({
  label,
  error,
  helper,
  multiline,
  rightAccessory,
  style,
  ...props
}: FormFieldProps) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors, isDarkMode);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            rightAccessory ? styles.inputWithAccessory : null,
            error && styles.inputError,
            style,
          ]}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
        />
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      ...typography.caption,
      color: colors.text,
      letterSpacing: 0.3,
    },
    inputShell: {
      position: 'relative',
    },
    input: {
      width: '100%',
      minHeight: 52,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#463A55' : colors.border,
      backgroundColor: isDarkMode ? '#201A2A' : colors.surface,
      color: colors.text,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...typography.body,
      fontSize: Platform.OS === 'web' ? 16 : typography.body.fontSize,
      ...(isDarkMode ? {} : shadows.soft),
    },
    inputWithAccessory: {
      paddingRight: 52,
    },
    rightAccessory: {
      position: 'absolute',
      right: spacing.md,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    multilineInput: {
      minHeight: 112,
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
