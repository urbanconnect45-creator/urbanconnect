import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserRole } from '../types/auth';

type JourneyMode = 'opening' | UserRole;

type Props = {
  firstName?: string;
  mode: JourneyMode;
  onComplete: () => void;
};

const openingDesktop = require('../../assets/journey/opening-desktop.png');
const openingMobile = require('../../assets/journey/opening-mobile-photo-v2.png');
const customerArtwork = require('../../assets/journey/customer-photo-v2.png');
const storeOwnerArtwork = require('../../assets/journey/store-owner.png');
const dispatchArtwork = require('../../assets/journey/dispatch.png');

const palette = {
  aqua: '#35D8E4',
  coral: '#FF643A',
  gold: '#FFD449',
  green: '#18D985',
  ink: '#0E0720',
  panel: 'rgba(20, 9, 45, 0.90)',
  purple: '#6C2DE3',
  purpleBright: '#9B5CFF',
  white: '#FFFFFF',
  whiteMuted: '#E5DCF4',
};

const roleMeta = {
  resident: {
    accent: palette.gold,
    artwork: customerArtwork,
    eyebrow: 'CUSTOMER',
    subtitle: 'Your marketplace is ready',
  },
  businessOwner: {
    accent: palette.coral,
    artwork: storeOwnerArtwork,
    eyebrow: 'STORE OWNER',
    subtitle: 'Your seller workspace is ready',
  },
  dispatch: {
    accent: palette.green,
    artwork: dispatchArtwork,
    eyebrow: 'DISPATCH',
    subtitle: 'Your delivery route is ready',
  },
} as const;

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.brandMark, compact && styles.brandMarkCompact]}>
      <Ionicons color={palette.white} name="bag-handle-outline" size={compact ? 28 : 46} />
      <Text style={[styles.brandNumber, compact && styles.brandNumberCompact]}>2</Text>
      <View style={[styles.brandDot, compact && styles.brandDotCompact]} />
    </View>
  );
}

export function MarketplaceJourneyAnimation({ firstName, mode, onComplete }: Props) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 800;
  const compactPhone = !wide && height < 650;
  const opening = mode === 'opening';
  const role = opening ? roleMeta.resident : roleMeta[mode];
  const name = firstName?.trim() || 'there';

  const fade = useRef(new Animated.Value(0)).current;
  const camera = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const finish = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, {
          duration: 650,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(camera, {
          duration: opening ? (wide ? 3600 : 3200) : 2800,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(opening ? 300 : 180),
          Animated.timing(content, {
            duration: 720,
            easing: Easing.out(Easing.back(1.08)),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(opening ? 520 : 420),
          Animated.timing(travel, {
            duration: opening ? 2200 : 1800,
            easing: Easing.inOut(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(opening ? 500 : 440),
      Animated.timing(finish, {
        duration: 360,
        easing: Easing.inOut(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);

    pulseLoop.start();
    sequence.start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });

    return () => {
      pulseLoop.stop();
      sequence.stop();
    };
  }, [camera, content, fade, finish, onComplete, opening, pulse, travel]);

  const artwork = opening ? (wide ? openingDesktop : openingMobile) : role.artwork;
  const cameraStyle = useMemo(
    () => ({
      opacity: fade,
      transform: [
        {
          scale: camera.interpolate({
            inputRange: [0, 1],
            outputRange: opening
              ? wide
                ? [1.025, 1]
                : [1.055, 1.01]
              : wide
                ? [1.03, 1]
                : [1.045, 1],
          }),
        },
        {
          translateY: camera.interpolate({
            inputRange: [0, 1],
            outputRange: opening
              ? [wide ? 5 : 12, wide ? 0 : -4]
              : [wide ? 8 : 12, wide ? 0 : -4],
          }),
        },
      ],
    }),
    [camera, fade, opening, wide],
  );
  const contentStyle = {
    opacity: content,
    transform: [
      { translateY: content.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
      { scale: content.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };
  const pulseStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.56, 1] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
  };
  const travelStyle = {
    opacity: travel.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
    transform: wide
      ? [
          { translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.19, width * 0.3] }) },
          { translateY: travel.interpolate({ inputRange: [0, 0.48, 1], outputRange: [height * 0.19, 8, height * 0.13] }) },
          { rotateZ: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-8deg', '8deg', '-4deg'] }) },
        ]
      : [
          { translateX: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-width * 0.2, width * 0.13, -width * 0.04] }) },
          { translateY: travel.interpolate({ inputRange: [0, 1], outputRange: [height * 0.23, -height * 0.19] }) },
        ],
  };

  return (
    <Animated.View
      accessibilityLabel={opening ? 'View2Connect is opening' : role.subtitle}
      accessibilityViewIsModal
      style={[styles.root, { minHeight: height, opacity: finish }]}
    >
      <Animated.Image resizeMode="cover" source={artwork} style={[styles.artwork, cameraStyle]} />
      <View pointerEvents="none" style={styles.topShade} />
      <View pointerEvents="none" style={styles.bottomShade} />

      {opening ? (
        <>
          <Animated.View
            style={[
              styles.openingIdentity,
              { top: Math.max(insets.top + 12, 24) },
              wide && styles.openingIdentityWide,
              contentStyle,
            ]}
          >
            <BrandMark />
            <Text style={[styles.openingName, wide && styles.openingNameWide]}>View2Connect</Text>
            <Text style={[styles.openingTagline, wide && styles.openingTaglineWide]}>
              Buy. Sell. Deliver. Connect locally.
            </Text>
          </Animated.View>
          {wide ? (
            <Animated.View style={[styles.travelBadge, travelStyle]}>
              <Ionicons color={palette.white} name="bicycle" size={29} />
            </Animated.View>
          ) : null}
          {!wide ? (
            <MobileOpeningDetails
              compact={compactPhone}
              contentStyle={contentStyle}
              pulseStyle={pulseStyle}
            />
          ) : null}
          <Animated.View
            style={[
              styles.connectionChip,
              { bottom: Math.max(insets.bottom + 14, 20) },
              contentStyle,
              pulseStyle,
            ]}
          >
            <View style={styles.liveDot} />
            <Text style={styles.connectionText}>MARKETPLACE CONNECTED</Text>
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View
            style={[
              styles.roleHeader,
              { top: Math.max(insets.top + 12, 24) },
              wide && styles.roleHeaderWide,
              contentStyle,
            ]}
          >
            <View style={styles.roleBrandRow}>
              <BrandMark compact />
              <View>
                <Text style={styles.roleBrand}>View2Connect</Text>
                <Text style={[styles.roleEyebrow, { color: role.accent }]}>{role.eyebrow}</Text>
              </View>
            </View>
            <Text style={[styles.welcome, wide && styles.welcomeWide]}>Welcome back, {name}</Text>
            <Text style={[styles.roleSubtitle, { color: role.accent }]}>{role.subtitle}</Text>
          </Animated.View>

          {mode === 'resident' ? <CustomerOverlay contentStyle={contentStyle} wide={wide} /> : null}
          {mode === 'businessOwner' ? <StoreOwnerOverlay contentStyle={contentStyle} wide={wide} /> : null}
          {mode === 'dispatch' ? (
            <DispatchOverlay contentStyle={contentStyle} pulseStyle={pulseStyle} travelStyle={travelStyle} wide={wide} />
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

function MobileOpeningDetails({
  compact,
  contentStyle,
  pulseStyle,
}: {
  compact: boolean;
  contentStyle: object;
  pulseStyle: object;
}) {
  const signals = [
    { icon: 'storefront-outline' as const, label: 'Shop local' },
    { icon: 'basket-outline' as const, label: 'Fresh food' },
    { icon: 'navigate-outline' as const, label: 'Delivery' },
  ];

  return (
    <Animated.View
      style={[styles.mobileSignalRow, compact && styles.mobileSignalRowCompact, contentStyle]}
    >
      {signals.map((signal, index) => (
        <View key={signal.label} style={styles.mobileSignalCard}>
          <Animated.View style={[styles.mobileSignalIcon, index === signals.length - 1 && pulseStyle]}>
            <Ionicons color={index === signals.length - 1 ? palette.green : palette.white} name={signal.icon} size={15} />
          </Animated.View>
          <Text style={styles.mobileSignalText}>{signal.label}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

function CustomerOverlay({ contentStyle, wide }: { contentStyle: object; wide: boolean }) {
  const categories = [
    ['nutrition', 'Groceries', palette.green],
    ['fast-food', 'Food', palette.coral],
    ['phone-portrait', 'Electronics', palette.aqua],
    ['megaphone', 'Local ads', palette.gold],
  ] as const;

  return (
    <Animated.View style={[styles.customerPanel, wide && styles.customerPanelWide, contentStyle]}>
      <View style={styles.searchBar}>
        <Ionicons color={palette.whiteMuted} name="search" size={16} />
        <Text style={styles.searchText}>Search products, stores...</Text>
        <Ionicons color={palette.white} name="cart-outline" size={19} />
      </View>
      <View style={styles.categoryRow}>
        {categories.map(([icon, label, color]) => (
          <View key={label} style={styles.categoryItem}>
            <View style={[styles.categoryIcon, { backgroundColor: color }]}>
              <Ionicons color={palette.white} name={icon} size={18} />
            </View>
            <Text style={styles.categoryText}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.dealStrip}>
        <View>
          <Text style={styles.dealTitle}>Fresh deals</Text>
          <Text style={styles.dealCopy}>From local stores</Text>
        </View>
        <Ionicons color={palette.gold} name="sparkles" size={28} />
      </View>
    </Animated.View>
  );
}

function StoreOwnerOverlay({ contentStyle, wide }: { contentStyle: object; wide: boolean }) {
  return (
    <Animated.View style={[styles.sellerCards, wide && styles.sellerCardsWide, contentStyle]}>
      <View style={styles.orderCard}>
        <View>
          <Text style={styles.cardKicker}>NEW ORDER</Text>
          <Text style={styles.cardTitle}>Order #4587</Text>
          <Text style={styles.cardCopy}>2 items · NGN 2,900</Text>
        </View>
        <View style={styles.cartCircle}>
          <Ionicons color={palette.white} name="cart" size={25} />
        </View>
      </View>
      <View style={styles.revenueCard}>
        <View>
          <Text style={styles.revenueLabel}>Today's revenue</Text>
          <Text style={styles.revenueValue}>NGN 12,470</Text>
          <Text style={styles.revenueGrowth}>+18.6%</Text>
        </View>
        <View style={styles.chart}>
          {[20, 35, 30, 48, 60].map((bar) => <View key={bar} style={[styles.chartBar, { height: bar }]} />)}
        </View>
      </View>
    </Animated.View>
  );
}

function DispatchOverlay({
  contentStyle,
  pulseStyle,
  travelStyle,
  wide,
}: {
  contentStyle: object;
  pulseStyle: object;
  travelStyle: object;
  wide: boolean;
}) {
  return (
    <>
      <Animated.View style={[styles.dispatchRider, travelStyle]}>
        <Ionicons color={palette.white} name="bicycle" size={27} />
      </Animated.View>
      <Animated.View style={[styles.etaCard, wide && styles.etaCardWide, contentStyle]}>
        <View>
          <Text style={styles.cardKicker}>ETA</Text>
          <Text style={styles.etaValue}>12 min</Text>
          <Text style={styles.cardCopy}>2.4 km away</Text>
        </View>
        <View style={styles.etaStatus}>
          <Animated.View style={[styles.liveDot, pulseStyle]} />
          <Text style={styles.etaStatusText}>ON MY WAY</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    overflow: 'hidden',
    backgroundColor: palette.ink,
    elevation: 10000,
  },
  artwork: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  topShade: { ...StyleSheet.absoluteFillObject, bottom: '58%', backgroundColor: 'rgba(8,2,27,0.24)' },
  bottomShade: { position: 'absolute', right: 0, bottom: 0, left: 0, height: '26%', backgroundColor: 'rgba(8,2,27,0.25)' },
  brandMark: {
    position: 'relative',
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(108,45,227,0.92)',
    shadowColor: palette.purpleBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 18,
    elevation: 12,
  },
  brandMarkCompact: { width: 48, height: 48 },
  brandNumber: { position: 'absolute', top: 13, right: 13, color: palette.white, fontSize: 12, fontWeight: '900' },
  brandNumberCompact: { top: 6, right: 7, fontSize: 9 },
  brandDot: { position: 'absolute', right: 7, bottom: 7, width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: palette.purple, backgroundColor: palette.coral },
  brandDotCompact: { right: 4, bottom: 4, width: 13, height: 13 },
  openingIdentity: { position: 'absolute', top: '7%', right: 22, left: 22, alignItems: 'center' },
  openingIdentityWide: { top: '18%', right: 'auto', left: '8%', alignItems: 'flex-start' },
  openingName: { marginTop: 12, color: palette.white, fontSize: 31, lineHeight: 38, fontWeight: '900' },
  openingNameWide: { fontSize: 48, lineHeight: 56 },
  openingTagline: { marginTop: 4, color: palette.whiteMuted, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  openingTaglineWide: { maxWidth: 420, fontSize: 22, lineHeight: 30, textAlign: 'left' },
  travelBadge: { position: 'absolute', top: '52%', left: '50%', width: 54, height: 54, alignItems: 'center', justifyContent: 'center', marginLeft: -27, borderRadius: 27, borderWidth: 2, borderColor: palette.white, backgroundColor: palette.green, shadowColor: palette.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 18, elevation: 14 },
  connectionChip: { position: 'absolute', right: 20, bottom: 24, left: 20, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: palette.panel },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.green },
  connectionText: { color: palette.white, fontSize: 11, lineHeight: 14, fontWeight: '900' },
  mobileSignalRow: { position: 'absolute', top: '28%', right: 18, left: 18, minHeight: 54, flexDirection: 'row', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(16,6,39,0.68)', paddingHorizontal: 6 },
  mobileSignalRowCompact: { top: '35%' },
  mobileSignalCard: { flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  mobileSignalIcon: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.08)' },
  mobileSignalText: { flexShrink: 1, color: palette.white, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  roleHeader: { position: 'absolute', top: 24, right: 20, left: 20, zIndex: 3, gap: 7 },
  roleHeaderWide: { top: 42, right: '7%', left: '7%' },
  roleBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  roleBrand: { color: palette.white, fontSize: 19, lineHeight: 23, fontWeight: '900' },
  roleEyebrow: { marginTop: 2, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  welcome: { color: palette.white, fontSize: 27, lineHeight: 34, fontWeight: '900' },
  welcomeWide: { fontSize: 39, lineHeight: 46 },
  roleSubtitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  customerPanel: { position: 'absolute', top: 182, right: 17, left: 17, gap: 13, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', backgroundColor: palette.panel, padding: 14 },
  customerPanelWide: { top: 188, right: '7%', left: '58%', padding: 20 },
  searchBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12 },
  searchText: { flex: 1, color: palette.whiteMuted, fontSize: 12, lineHeight: 16 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
  categoryItem: { flex: 1, alignItems: 'center', gap: 5 },
  categoryIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  categoryText: { color: palette.white, fontSize: 8, lineHeight: 11, fontWeight: '700', textAlign: 'center' },
  dealStrip: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, backgroundColor: 'rgba(18,163,103,0.9)', paddingHorizontal: 14 },
  dealTitle: { color: palette.white, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  dealCopy: { color: '#D9FFF0', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  sellerCards: { position: 'absolute', right: 18, bottom: 24, left: 18, gap: 11 },
  sellerCardsWide: { right: '7%', bottom: '10%', left: '61%' },
  orderCard: { minHeight: 91, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: palette.panel, padding: 15 },
  cardKicker: { color: palette.gold, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  cardTitle: { marginTop: 3, color: palette.white, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  cardCopy: { marginTop: 2, color: palette.whiteMuted, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  cartCircle: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: palette.green },
  revenueCard: { minHeight: 102, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, borderRadius: 8, backgroundColor: '#FAF8FD', padding: 15 },
  revenueLabel: { color: '#4B3A61', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  revenueValue: { marginTop: 3, color: '#1C102D', fontSize: 23, lineHeight: 28, fontWeight: '900' },
  revenueGrowth: { color: '#13A467', fontSize: 11, lineHeight: 15, fontWeight: '900' },
  chart: { height: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  chartBar: { width: 8, borderRadius: 4, backgroundColor: palette.green },
  dispatchRider: { position: 'absolute', top: '51%', left: '50%', width: 51, height: 51, alignItems: 'center', justifyContent: 'center', marginLeft: -26, borderRadius: 26, borderWidth: 2, borderColor: palette.white, backgroundColor: palette.green },
  etaCard: { position: 'absolute', right: 18, bottom: 25, left: 18, minHeight: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: palette.panel, padding: 16 },
  etaCardWide: { right: '7%', bottom: '8%', left: '65%' },
  etaValue: { marginTop: 2, color: palette.white, fontSize: 29, lineHeight: 34, fontWeight: '900' },
  etaStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 8, backgroundColor: 'rgba(24,217,133,0.17)', paddingHorizontal: 11, paddingVertical: 9 },
  etaStatusText: { color: palette.green, fontSize: 10, lineHeight: 13, fontWeight: '900' },
});
