import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type FlutterwaveCheckoutModalProps = {
  checkoutUrl?: string | undefined;
  reference?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  activePaymentLabel?: string | undefined;
  visible: boolean;
  onClose: () => void;
};

function isFlutterwaveReturnUrl(url?: string) {
  const normalizedUrl = (url ?? '').toLowerCase();

  return (
    normalizedUrl.startsWith('urbanconnect://payments/flutterwave') ||
    normalizedUrl.includes('/payments/flutterwave/return') ||
    normalizedUrl.includes('/payments/flutterwave/cancel')
  );
}

export function FlutterwaveCheckoutModal({
  activePaymentLabel,
  checkoutUrl,
  onClose,
  reference,
  subtitle = 'Complete payment securely on Flutterwave.',
  title,
  visible,
}: FlutterwaveCheckoutModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const openedUrlRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const openCheckout = async () => {
    if (!checkoutUrl) {
      setLaunchError('Flutterwave did not return a checkout link.');
      return;
    }

    try {
      setLaunchError(null);
      openedUrlRef.current = checkoutUrl;

      if (Platform.OS === 'web') {
        const browserWindow = globalThis as {
          location?: { assign: (url: string) => void };
          sessionStorage?: { setItem: (key: string, value: string) => void };
        };
        browserWindow.sessionStorage?.setItem('view2connect.flutterwave.webReturn', '1');
        browserWindow.location?.assign(checkoutUrl);
        return;
      }

      await Linking.openURL(checkoutUrl);
      openedUrlRef.current = null;
      onClose();
    } catch {
      openedUrlRef.current = null;
      setLaunchError('Unable to open Flutterwave in your browser. Try again.');
    }
  };

  useEffect(() => {
    if (!visible || !checkoutUrl || openedUrlRef.current === checkoutUrl) {
      return;
    }

    void openCheckout();
  }, [checkoutUrl, visible]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      if (isFlutterwaveReturnUrl(url)) {
        openedUrlRef.current = null;
        onClose();
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        visible &&
        nextState === 'active' &&
        /inactive|background/.test(previousState)
      ) {
        openedUrlRef.current = null;
        onClose();
      }
    });

    return () => {
      linkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [onClose, visible]);

  if (!visible || Platform.OS === 'web') {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconShell}>
            <Ionicons color={colors.white} name="open-outline" size={26} />
          </View>
          <Text style={styles.eyebrow}>Flutterwave browser checkout</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {activePaymentLabel ? (
            <View style={styles.channelPill}>
              <Ionicons color={colors.primary} name="card-outline" size={17} />
              <Text style={styles.channelText}>{activePaymentLabel}</Text>
            </View>
          ) : null}
          {reference ? <Text style={styles.referenceText}>{reference}</Text> : null}
          <Text style={styles.statusText}>
            Checkout opens in your browser and this overlay closes immediately. Returning to
            View2Connect never confirms payment by itself; Flutterwave must confirm it.
          </Text>
          {launchError ? <Text style={styles.errorText}>{launchError}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={() => void openCheckout()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color={colors.white} name="open-outline" size={18} />
              <Text style={styles.primaryButtonText}>Open checkout again</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Return to View2Connect</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 480,
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...shadows.card,
    },
    iconShell: {
      width: 50,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: colors.primary,
    },
    title: {
      ...typography.section,
      color: colors.text,
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    channelPill: {
      alignSelf: 'flex-start',
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
    },
    channelText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    referenceText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    statusText: {
      ...typography.body,
      color: colors.text,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    actions: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    primaryButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
    },
    primaryButtonText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    secondaryButton: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    secondaryButtonText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
