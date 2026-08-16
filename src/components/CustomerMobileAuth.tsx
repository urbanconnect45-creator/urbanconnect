import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { UrbanConnectLogo } from './UrbanConnectLogo';

type ShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  subtitle: string;
  title: string;
};

export function CustomerMobileAuthShell({ children, footer, subtitle, title }: ShellProps) {
  const { colors, isDarkMode } = useAppTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 720;
  const narrow = width < 350;
  const styles = createStyles(colors, isDarkMode, compact, narrow);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          styles.content,
          { minHeight: Math.max(height - insets.top - insets.bottom, 0) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <UrbanConnectLogo />
            <View style={styles.roleChip}><Text style={styles.roleText}>Customer</Text></View>
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.form}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  rightAccessory?: ReactNode;
};

export function CustomerMobileField({ icon, label, rightAccessory, style, ...props }: FieldProps) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createFieldStyles(colors, isDarkMode);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.shell}>
        <Ionicons color={colors.primary} name={icon} size={18} />
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...props}
        />
        {rightAccessory}
      </View>
    </View>
  );
}

type SegmentProps<T extends string> = {
  onChange: (value: T) => void;
  options: { icon: keyof typeof Ionicons.glyphMap; label: string; value: T }[];
  value: T;
};

export function CustomerMobileSegments<T extends string>({ onChange, options, value }: SegmentProps<T>) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createFieldStyles(colors, isDarkMode);
  return (
    <View style={styles.segments}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
          >
            <Ionicons color={active ? colors.white : colors.primary} name={option.icon} size={17} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type PhoneProps = {
  countryCode: string;
  onChangeCountryCode: (value: string) => void;
  onChangeText: (value: string) => void;
  options: readonly { code: string; label: string }[];
  value: string;
};

export function CustomerMobilePhoneField({ countryCode, onChangeCountryCode, onChangeText, options, value }: PhoneProps) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createFieldStyles(colors, isDarkMode);
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.code === countryCode) ?? options[0];
  return (
    <>
      <View style={styles.wrapper}>
        <Text style={styles.label}>Phone number</Text>
        <View style={styles.shell}>
          <Ionicons color={colors.primary} name="call-outline" size={18} />
          <Pressable onPress={() => setOpen(true)} style={styles.countryTrigger}>
            <Text style={styles.countryTriggerText}>{selected?.label} {countryCode}</Text>
            <Ionicons color={colors.textMuted} name="chevron-down" size={15} />
          </Pressable>
          <View style={styles.verticalDivider} />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={onChangeText}
            placeholder={countryCode === '+234' ? '8012345678' : 'Phone number'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={value}
          />
        </View>
      </View>
      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={styles.modalBackdrop}>
          <View style={styles.countryMenu}>
            <Text style={styles.countryMenuTitle}>Country code</Text>
            {options.map((option) => (
              <Pressable
                key={option.code}
                onPress={() => { onChangeCountryCode(option.code); setOpen(false); }}
                style={({ pressed }) => [styles.countryOption, pressed && styles.pressed]}
              >
                <Text style={styles.countryOptionText}>{option.label}</Text>
                <Text style={styles.countryOptionCode}>{option.code}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean, compact: boolean, narrow: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: isDarkMode ? '#100C18' : '#FFFFFF' },
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      justifyContent: 'space-between',
      gap: compact ? 8 : 12,
      paddingHorizontal: narrow ? 12 : 18,
      paddingTop: compact ? 8 : 14,
      paddingBottom: compact ? 8 : 14,
    },
    header: {
      gap: compact ? 8 : 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: compact ? 8 : 12,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    roleChip: { minHeight: 28, justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primarySoft, paddingHorizontal: 10 },
    roleText: { color: colors.primary, fontSize: 11, lineHeight: 15, fontWeight: '800' },
    heading: { gap: 2 },
    title: { color: colors.text, fontSize: compact ? 22 : 26, lineHeight: compact ? 27 : 32, fontWeight: '900' },
    subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '500' },
    form: { gap: compact ? 7 : 10 },
    footer: { alignItems: 'center', justifyContent: 'center', minHeight: 34 },
  });
}

function createFieldStyles(colors: AppColors, isDarkMode: boolean) {
  return StyleSheet.create({
    wrapper: { gap: 4, minWidth: 0 },
    label: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '700' },
    shell: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#4A3D5D' : '#DDD5ED',
      backgroundColor: isDarkMode ? '#1D1726' : '#FBFAFD',
      paddingHorizontal: 12,
    },
    input: { flex: 1, minWidth: 0, minHeight: 44, color: colors.text, fontSize: 16, lineHeight: 20, paddingVertical: 0 },
    segments: { minHeight: 46, flexDirection: 'row', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: isDarkMode ? '#17111F' : '#F3EFFA', padding: 3 },
    segment: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 6 },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.primary, fontSize: 13, lineHeight: 17, fontWeight: '800' },
    segmentTextActive: { color: colors.white },
    countryTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 },
    countryTriggerText: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: '800' },
    verticalDivider: { width: 1, height: 24, backgroundColor: colors.border },
    pressed: { opacity: 0.78 },
    modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: colors.backdrop, padding: 24 },
    countryMenu: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: 4, borderRadius: 8, backgroundColor: colors.surface, padding: 14 },
    countryMenuTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 6 },
    countryOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8 },
    countryOptionText: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    countryOptionCode: { color: colors.primary, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  });
}
