import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AuthPageBackground } from '../components/AuthPageBackground';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { spacing } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

export function PasswordRecoveryScreen() {
  const { cancelPasswordRecovery, completePasswordRecovery } = useAuth();
  const { colors } = useAppTheme();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await completePasswordRecovery(password);
      Alert.alert('Password updated', 'Sign in again with your new password.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update the password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthPageBackground contentContainerStyle={styles.page} minimalMobile>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="key-outline" size={24} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Create a new password</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Use at least 8 characters.</Text>
        <FormField
          label="New password"
          onChangeText={setPassword}
          placeholder="Enter new password"
          rightAccessory={
            <Pressable
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              onPress={() => setPasswordVisible((current) => !current)}
            >
              <Ionicons
                color={colors.textMuted}
                name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
              />
            </Pressable>
          }
          secureTextEntry={!passwordVisible}
          value={password}
        />
        <FormField
          label="Confirm password"
          onChangeText={setConfirmation}
          placeholder="Confirm new password"
          secureTextEntry={!passwordVisible}
          value={confirmation}
        />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <AppButton label="Update password" loading={isSaving} onPress={() => void submit()} />
        <AppButton label="Cancel" onPress={cancelPasswordRecovery} variant="ghost" />
      </View>
    </AuthPageBackground>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: 8,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: -8,
    fontSize: 15,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
  },
});
