import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import type { AdminLoginScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

function MonoButton({
  dark = true,
  disabled = false,
  label,
  loading = false,
  onPress,
}: {
  dark?: boolean;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.monoButtonShell, disabled && styles.monoButtonDisabled]}>
      <Text
        onPress={disabled || loading ? undefined : onPress}
        style={[
          styles.monoButton,
          dark ? styles.monoButtonDark : styles.monoButtonLight,
        ]}
      >
        {loading ? 'Please wait...' : label}
      </Text>
    </View>
  );
}

export function AdminLoginScreen({ navigation }: AdminLoginScreenProps) {
  const { signInAdmin } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim().includes('@')) {
      setError('Use a valid admin email address.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await signInAdmin({ email, password });
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : 'Unable to sign in right now.';
      setError(message);
      Alert.alert('Admin login failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.loginCard}>
        <Text style={styles.eyebrow}>Admin</Text>
        <Text style={styles.title}>Local admin login</Text>
        <Text style={styles.subtitle}>
          Owner controls everything. Customer care stays limited and can be activated or deactivated by the owner.
        </Text>

        <View style={styles.formCard}>
          <FormField
            autoCapitalize="none"
            label="Admin email"
            onChangeText={setEmail}
            placeholder="owner.admin@urbanconnect.com"
            value={email}
          />
          <FormField
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter admin password"
            secureTextEntry
            value={password}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <MonoButton dark label="Login to admin" loading={isLoading} onPress={() => void handleLogin()} />
          <MonoButton dark={false} label="Return to app" onPress={() => navigation.navigate('Login')} />
        </View>

        <Text style={styles.adminNote}>
          Admin access is private. Use the owner or customer care credentials created in
          the admin system.
        </Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xl,
      padding: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xl,
    },
    loginCard: {
      width: '100%',
      maxWidth: 430,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: '#111111',
      padding: spacing.xl,
      ...shadows.card,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#111111',
    },
    title: {
      ...typography.title,
      color: '#111111',
    },
    subtitle: {
      ...typography.body,
      color: '#555555',
    },
    formCard: {
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: '#FAFAFA',
      borderWidth: 1,
      borderColor: '#D8D8D8',
      padding: spacing.lg,
    },
    resetCard: {
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D8D8D8',
      padding: spacing.md,
    },
    sectionTitle: {
      ...typography.section,
      color: '#111111',
    },
    errorText: {
      ...typography.caption,
      color: '#111111',
    },
    adminNote: {
      ...typography.caption,
      color: '#666666',
      textAlign: 'center',
    },
    demoCard: {
      gap: spacing.sm,
    },
    roleStack: {
      gap: spacing.sm,
    },
    demoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D8D8D8',
      padding: spacing.md,
    },
    demoCopy: {
      flex: 1,
      gap: 4,
      minWidth: 180,
    },
    demoTitle: {
      ...typography.bodyStrong,
      color: '#111111',
    },
    demoMeta: {
      ...typography.caption,
      color: '#666666',
    },
    monoButtonShell: {
      width: '100%',
    },
    monoButton: {
      overflow: 'hidden',
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      textAlign: 'center',
      ...typography.bodyStrong,
    },
    monoButtonDark: {
      backgroundColor: '#111111',
      borderColor: '#111111',
      color: '#FFFFFF',
    },
    monoButtonLight: {
      backgroundColor: '#FFFFFF',
      borderColor: '#111111',
      color: '#111111',
    },
    monoButtonDisabled: {
      opacity: 0.5,
    },
    useLink: {
      ...typography.bodyStrong,
      color: '#111111',
    },
    useLinkDisabled: {
      color: '#9B9B9B',
    },
  });
}
