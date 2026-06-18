import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type SelectedAsset = {
  label: string;
  uri: string;
};

type MediaPickerFieldProps = {
  assets: SelectedAsset[];
  buttonLabel: string;
  helper?: string;
  kind: 'image' | 'video';
  label: string;
  onClear?: () => void;
  onPick: () => void;
};

export function MediaPickerField({
  assets,
  buttonLabel,
  helper,
  kind,
  label,
  onClear,
  onPick,
}: MediaPickerFieldProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <Pressable
        onPress={onPick}
        style={({ pressed }) => [styles.pickButton, pressed && styles.pickButtonPressed]}
      >
        <View style={styles.pickIconShell}>
          <Ionicons
            color={colors.primary}
            name="add-circle-outline"
            size={20}
          />
        </View>
        <View style={styles.pickCopy}>
          <Text style={styles.pickTitle}>{buttonLabel}</Text>
          <Text style={styles.pickText}>
            {kind === 'image'
              ? 'Tap the plus to choose from the gallery.'
              : 'Tap the plus to choose videos from the gallery.'}
          </Text>
        </View>
      </Pressable>

      {assets.length > 0 ? (
        <View style={styles.previewSection}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewRow}
          >
            {assets.map((asset) =>
              kind === 'image' ? (
                <View key={`${asset.label}-${asset.uri}`} style={styles.imagePreviewCard}>
                  <Image resizeMode="cover" source={{ uri: asset.uri }} style={styles.imagePreview} />
                  <Text numberOfLines={1} style={styles.previewLabel}>
                    {asset.label}
                  </Text>
                </View>
              ) : (
                <View key={`${asset.label}-${asset.uri}`} style={styles.videoPreviewCard}>
                  <View style={styles.videoIconShell}>
                    <Ionicons color={colors.secondary} name="play-circle-outline" size={20} />
                  </View>
                  <Text numberOfLines={2} style={styles.previewLabel}>
                    {asset.label}
                  </Text>
                </View>
              ),
            )}
          </ScrollView>

          {onClear ? (
            <Pressable
              onPress={onClear}
              style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
            >
              <Text style={styles.clearButtonText}>Clear selected media</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    label: {
      ...typography.caption,
      color: colors.text,
      letterSpacing: 0.3,
    },
    helper: {
      ...typography.caption,
      color: colors.textMuted,
    },
    pickButton: {
      flexDirection: 'row',
      gap: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      ...shadows.soft,
    },
    pickButtonPressed: {
      opacity: 0.92,
    },
    pickIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: colors.primarySoft,
    },
    pickCopy: {
      flex: 1,
      gap: 4,
    },
    pickTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    pickText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    previewSection: {
      gap: spacing.sm,
    },
    previewRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    imagePreviewCard: {
      width: 118,
      gap: spacing.xs,
    },
    imagePreview: {
      height: 92,
      width: 118,
      borderRadius: radii.md,
    },
    videoPreviewCard: {
      width: 138,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    videoIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      width: 36,
      borderRadius: 18,
      backgroundColor: colors.secondarySoft,
    },
    previewLabel: {
      ...typography.caption,
      color: colors.text,
    },
    clearButton: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      backgroundColor: colors.secondarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    clearButtonPressed: {
      opacity: 0.92,
    },
    clearButtonText: {
      ...typography.caption,
      color: colors.secondary,
    },
  });
}
