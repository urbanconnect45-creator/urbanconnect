import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { ProfessionCard } from '../components/ProfessionCard';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { getBusinessPriorityScore, isPublicBusiness } from '../utils/businessState';

export function ProfessionsScreen({ navigation }: MainTabsScreenProps<'Professions'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { businesses, currentEstateId, estates } = useBusinessDirectory();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedEstate = estates.find((estate) => estate.id === currentEstateId) ?? estates[0];
  const professionListings = useMemo(
    () =>
      businesses
        .filter(
          (business) =>
            business.estateId === selectedEstate?.id &&
            business.listingType === 'profession' &&
            isPublicBusiness(business),
        )
        .sort(
          (leftBusiness, rightBusiness) =>
            getBusinessPriorityScore(rightBusiness) - getBusinessPriorityScore(leftBusiness),
        ),
    [businesses, selectedEstate?.id],
  );
  const availableCategories = useMemo(
    () => ['All', ...new Set(professionListings.map((business) => business.category))],
    [professionListings],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isMobile = width < 780;

  useEffect(() => {
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [availableCategories, selectedCategory]);

  const filteredProfessions = professionListings.filter((business) => {
    const matchesCategory =
      selectedCategory === 'All' ? true : business.category === selectedCategory;
    const matchesSearch =
      normalizedQuery.length === 0
        ? true
        : [
            business.name,
            business.description,
            business.category,
            business.ownerName,
            business.cluster,
            business.services.join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const columnCount = width >= 1280 ? 3 : 2;
  return (
    <View style={styles.screen}>
      <FlatList
        key={`professions-${columnCount}`}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No services match that search yet.</Text>
            <Text style={styles.emptyText}>
              Try another service category or search by skill, owner, or cluster.
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <View style={styles.heroOrbOne} />
              <View style={styles.heroOrbTwo} />
              <Text style={styles.eyebrow}>Services</Text>
              <Text style={styles.title}>Find River Park services.</Text>
              <Text style={styles.subtitle}>
                Browse approved service providers. Use customer care if you need help with next
                steps.
              </Text>

              <View style={styles.highlightRow}>
                <View style={styles.highlightPill}>
                  <Text style={styles.highlightText}>Doctor</Text>
                </View>
                <View style={styles.highlightPill}>
                  <Text style={styles.highlightText}>Nurse</Text>
                </View>
                <View style={styles.highlightPill}>
                  <Text style={styles.highlightText}>Phone Repair</Text>
                </View>
                <View style={styles.highlightPill}>
                  <Text style={styles.highlightText}>Hair Stylist</Text>
                </View>
              </View>

              <View style={styles.heroActions}>
                <AppButton
                  label="Back to shop"
                  onPress={() => navigation.navigate('Dashboard')}
                  variant="secondary"
                />
                {user?.role === 'businessOwner' ? (
                  <AppButton
                    label="Create service"
                    onPress={() => navigation.navigate('RegisterBusiness')}
                    variant="ghost"
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search services</Text>
              <View style={styles.sectionPanel}>
                <View style={styles.searchShell}>
                  <Ionicons color={colors.textMuted} name="search-outline" size={18} />
                  <TextInput
                    onChangeText={setSearchQuery}
                    placeholder="Search nurse, doctor, phone repair, owner, or cluster"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    value={searchQuery}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Browse by service</Text>
              <View style={styles.sectionPanel}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalRow}
                >
                  {availableCategories.map((category) => {
                    const isActive = category === selectedCategory;

                    return (
                      <Text
                        key={category}
                        onPress={() => setSelectedCategory(category)}
                        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      >
                        {category}
                      </Text>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        }
        columnWrapperStyle={columnCount > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.container, isMobile && styles.mobileContainer]}
        data={filteredProfessions}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        renderItem={({ item }) => (
          <ProfessionCard
            actionLabel="View"
            business={item}
            onActionPress={() => navigation.navigate('BusinessDetails', { businessId: item.id })}
            onPress={() => navigation.navigate('BusinessDetails', { businessId: item.id })}
            onProfilePress={() => {
              if (item.ownerUserId) {
                navigation.navigate('SellerProfile', { userId: item.ownerUserId });
              }
            }}
            style={columnCount > 1 ? styles.columnCard : undefined}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    mobileContainer: {
      paddingBottom: spacing.lg,
    },
    headerContent: {
      gap: spacing.lg,
      paddingBottom: spacing.sm,
    },
    hero: {
      position: 'relative',
      overflow: 'hidden',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroOrbOne: {
      position: 'absolute',
      top: -28,
      right: -10,
      height: 136,
      width: 136,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.26)',
    },
    heroOrbTwo: {
      position: 'absolute',
      bottom: -46,
      left: -18,
      height: 156,
      width: 156,
      borderRadius: 999,
      backgroundColor: 'rgba(58, 144, 158, 0.24)',
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#D7EAE2',
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    subtitle: {
      ...typography.body,
      color: '#D6DFE2',
      maxWidth: 720,
    },
    highlightRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    highlightPill: {
      borderRadius: radii.pill,
      backgroundColor: colors.overlayMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    highlightText: {
      ...typography.caption,
      color: colors.white,
    },
    heroActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    sectionPanel: {
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    searchShell: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      ...typography.body,
    },
    horizontalRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    categoryChip: {
      overflow: 'hidden',
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.bodyStrong,
    },
    categoryChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      color: colors.primary,
    },
    columnWrapper: {
      gap: spacing.lg,
    },
    columnCard: {
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.soft,
    },
    emptyTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
