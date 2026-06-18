import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

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
  onPaymentReturn?: ((url: string) => void) | undefined;
};

const paymentOptions = [
  { icon: 'card-outline', label: 'Card' },
  { icon: 'business-outline', label: 'Bank' },
] as const;

function isUrbanConnectReturnUrl(url?: string) {
  return Boolean(url?.startsWith('urbanconnect://payments/flutterwave'));
}

function isFlutterwaveStatusReturnUrl(url?: string) {
  const normalizedUrl = (url ?? '').toLowerCase();

  return Boolean(
    normalizedUrl.includes('flutterwave') &&
      (normalizedUrl.includes('status=') ||
        normalizedUrl.includes('transaction_id=') ||
        normalizedUrl.includes('tx_ref=')),
  );
}

function isPaymentReturnUrl(url?: string) {
  return isUrbanConnectReturnUrl(url) || isFlutterwaveStatusReturnUrl(url);
}

function isCancelledFlutterwaveReturnUrl(url?: string) {
  if (!isPaymentReturnUrl(url)) {
    return false;
  }

  const normalizedUrl = (url ?? '').toLowerCase();

  return (
    normalizedUrl.includes('status=cancelled') ||
    normalizedUrl.includes('status=canceled') ||
    normalizedUrl.includes('status=failed') ||
    normalizedUrl.includes('status=error')
  );
}

function isSuccessfulFlutterwaveReturnUrl(url?: string) {
  if (!isPaymentReturnUrl(url) || isCancelledFlutterwaveReturnUrl(url)) {
    return false;
  }

  const normalizedUrl = (url ?? '').toLowerCase();

  return (
    normalizedUrl.includes('status=successful') ||
    normalizedUrl.includes('status=success') ||
    normalizedUrl.includes('status=completed')
  );
}

export function FlutterwaveCheckoutModal({
  activePaymentLabel,
  checkoutUrl,
  onClose,
  onPaymentReturn,
  reference,
  subtitle = 'Complete payment with card or bank transfer.',
  title,
  visible,
}: FlutterwaveCheckoutModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const hasReturnedRef = useRef(false);
  const visiblePaymentOptions = activePaymentLabel
    ? paymentOptions.filter((option) => option.label === activePaymentLabel)
    : paymentOptions;

  useEffect(() => {
    if (visible) {
      hasReturnedRef.current = false;
    }
  }, [checkoutUrl, visible]);

  const closeCheckout = () => {
    if (hasReturnedRef.current) {
      return;
    }

    hasReturnedRef.current = true;
    onClose();
  };

  const closeAfterProviderReturn = closeCheckout;

  const handlePaymentReturn = (url: string) => {
    if (hasReturnedRef.current) {
      return;
    }

    hasReturnedRef.current = true;
    onPaymentReturn?.(url);
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal animationType="slide" onRequestClose={closeCheckout} visible={visible}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable
              accessibilityRole="button"
              onPress={closeCheckout}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color={colors.white} name="chevron-back" size={24} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Flutterwave checkout</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={closeCheckout}
              style={({ pressed }) => [
                styles.doneButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.optionRow}>
            {visiblePaymentOptions.map((option) => (
              <View key={option.label} style={styles.optionChip}>
                <Ionicons color={colors.white} name={option.icon} size={16} />
                <Text style={styles.optionText}>{option.label}</Text>
              </View>
            ))}
          </View>

          {reference ? <Text style={styles.referenceText}>{reference}</Text> : null}
        </View>

        <View style={styles.checkoutShell}>
          {checkoutUrl ? (
            <WebView
              key={checkoutUrl}
              allowsBackForwardNavigationGestures
              domStorageEnabled
              javaScriptEnabled
              onNavigationStateChange={(state) => {
                if (isCancelledFlutterwaveReturnUrl(state.url)) {
                  closeAfterProviderReturn();
                }

                if (isSuccessfulFlutterwaveReturnUrl(state.url)) {
                  handlePaymentReturn(state.url);
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                if (isCancelledFlutterwaveReturnUrl(request.url)) {
                  closeAfterProviderReturn();
                  return false;
                }

                if (isSuccessfulFlutterwaveReturnUrl(request.url)) {
                  handlePaymentReturn(request.url);
                  return false;
                }

                return true;
              }}
              originWhitelist={['*']}
              renderLoading={() => (
                <View style={styles.loadingState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingText}>Opening secure checkout</Text>
                </View>
              )}
              source={{ uri: checkoutUrl }}
              startInLoadingState
              style={styles.webView}
            />
          ) : (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Preparing checkout</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.card,
    },
    header: {
      minHeight: 190,
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.xxl,
    },
    headerTopRow: {
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.overlayMuted,
    },
    headerCopy: {
      flex: 1,
      gap: 3,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#D7EAE2',
    },
    title: {
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '900',
      color: colors.white,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: '#D6DFE2',
    },
    doneButton: {
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.secondary,
      paddingHorizontal: spacing.md,
    },
    doneButtonText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    optionRow: {
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    optionChip: {
      flex: 1,
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.overlayMuted,
      paddingHorizontal: spacing.sm,
    },
    optionText: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '900',
      color: colors.white,
    },
    referenceText: {
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
      ...typography.caption,
      color: '#D6DFE2',
    },
    checkoutShell: {
      flex: 1,
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      ...shadows.soft,
    },
    webView: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
    },
    loadingText: {
      ...typography.bodyStrong,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
  });
}
