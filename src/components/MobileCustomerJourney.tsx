import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  firstName?: string;
  mode: 'opening' | 'resident';
  onComplete: () => void;
};

const appLogo = require('../../assets/app-icon.png');

const palette = {
  background: '#1A0638',
  backgroundRaised: '#271052',
  coral: '#F6603A',
  gold: '#F3C950',
  green: '#4DE0A0',
  white: '#FFFFFF',
  whiteMuted: '#D9D0EA',
};

const openingSignals = [
  {
    accent: palette.green,
    icon: 'storefront-outline' as const,
    label: 'Shop local',
    detail: 'Stores, food and groceries',
  },
  {
    accent: palette.gold,
    icon: 'megaphone-outline' as const,
    label: 'Sell nearby',
    detail: 'Products and customer adverts',
  },
  {
    accent: palette.coral,
    icon: 'navigate-outline' as const,
    label: 'Deliver safely',
    detail: 'Secure orders and live tracking',
  },
] as const;

const readySignals = [
  { accent: palette.green, icon: 'storefront-outline' as const, label: 'Stores ready' },
  { accent: palette.gold, icon: 'shield-checkmark-outline' as const, label: 'Checkout secure' },
  { accent: palette.coral, icon: 'navigate-outline' as const, label: 'Delivery connected' },
] as const;

export function MobileCustomerJourney({ firstName, mode, onComplete }: Props) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 650;
  const narrow = width < 350;
  const opening = mode === 'opening';
  const name = firstName?.trim() || 'there';
  const [reduceMotion, setReduceMotion] = useState(false);

  const logo = useRef(new Animated.Value(0)).current;
  const brand = useRef(new Animated.Value(0)).current;
  const route = useRef(new Animated.Value(0)).current;
  const features = useRef(new Animated.Value(0)).current;
  const signal = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const finish = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    logo.setValue(reduceMotion ? 1 : 0);
    brand.setValue(reduceMotion ? 1 : 0);
    route.setValue(reduceMotion ? 1 : 0);
    features.setValue(reduceMotion ? 1 : 0);
    signal.setValue(reduceMotion ? 1 : 0);
    pulse.setValue(0);
    finish.setValue(1);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const sequence = reduceMotion
      ? Animated.sequence([
          Animated.delay(1150),
          Animated.timing(finish, { duration: 160, toValue: 0, useNativeDriver: true }),
        ])
      : Animated.sequence([
          Animated.parallel([
            Animated.timing(logo, {
              duration: 560,
              easing: Easing.out(Easing.back(1.08)),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(210),
              Animated.timing(brand, {
                duration: 480,
                easing: Easing.out(Easing.cubic),
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.delay(430),
              Animated.timing(route, {
                duration: 760,
                easing: Easing.inOut(Easing.cubic),
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.delay(760),
              Animated.timing(features, {
                duration: 620,
                easing: Easing.out(Easing.cubic),
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.delay(540),
              Animated.timing(signal, {
                duration: 1180,
                easing: Easing.inOut(Easing.cubic),
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.delay(340),
          Animated.timing(finish, {
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]);

    if (!reduceMotion) pulseLoop.start();
    sequence.start(({ finished }) => {
      if (finished) onComplete();
    });

    return () => {
      pulseLoop.stop();
      sequence.stop();
    };
  }, [brand, features, finish, logo, mode, onComplete, pulse, reduceMotion, route, signal]);

  const logoStyle = {
    opacity: logo,
    transform: [
      { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
      { rotateZ: logo.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '0deg'] }) },
    ],
  };
  const brandStyle = {
    opacity: brand,
    transform: [{ translateY: brand.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const routeStyle = {
    opacity: route,
    transform: [{ scaleY: route.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }],
  };
  const featureStyle = {
    opacity: features,
    transform: [{ translateY: features.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  const movingSignalStyle = {
    opacity: signal.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
    transform: [
      { translateY: signal.interpolate({ inputRange: [0, 1], outputRange: [-82, 82] }) },
      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.14] }) },
    ],
  };

  return (
    <Animated.View
      accessibilityLabel={opening ? 'View2Connect is opening' : `Welcome back, ${name}`}
      accessibilityViewIsModal
      style={[styles.root, { opacity: finish }]}
    >
      <ConnectionBackdrop />

      {opening ? (
        <View style={[styles.openingLayout, { paddingTop: Math.max(insets.top + 18, 28) }]}>
          <Animated.View style={[styles.openingBrand, logoStyle]}>
            <Image accessible={false} resizeMode="contain" source={appLogo} style={[styles.logo, compact && styles.logoCompact]} />
          </Animated.View>
          <Animated.View style={[styles.openingCopy, brandStyle]}>
            <Text style={[styles.brandName, narrow && styles.brandNameNarrow]}>View2Connect</Text>
            <Text style={styles.openingTitle}>Buy. Sell. Deliver.</Text>
            <Text style={styles.openingSubtitle}>Everything local, connected in one place.</Text>
          </Animated.View>

          <View style={[styles.journey, compact && styles.journeyCompact]}>
            <Animated.View style={[styles.routeLine, routeStyle]} />
            <Animated.View style={[styles.movingSignal, movingSignalStyle]} />
            <Animated.View style={[styles.signalList, featureStyle]}>
              {openingSignals.map((item) => (
                <View key={item.label} style={styles.signalRow}>
                  <View style={[styles.signalIcon, { borderColor: item.accent }]}>
                    <Ionicons color={item.accent} name={item.icon} size={20} />
                  </View>
                  <View style={styles.signalCopy}>
                    <Text style={styles.signalLabel}>{item.label}</Text>
                    <Text style={styles.signalDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.readyLayout,
            {
              paddingTop: Math.max(insets.top + 20, 30),
              paddingBottom: Math.max(insets.bottom + 20, 28),
            },
          ]}
        >
          <Animated.View style={[styles.readyBrand, logoStyle]}>
            <Image accessible={false} resizeMode="contain" source={appLogo} style={styles.readyLogo} />
            <Text style={styles.readyBrandName}>View2Connect</Text>
          </Animated.View>

          <Animated.View style={[styles.readyCenter, brandStyle]}>
            <Animated.View
              style={[
                styles.readyCheck,
                { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }] },
              ]}
            >
              <Ionicons color={palette.green} name="checkmark" size={42} />
            </Animated.View>
            <Text style={[styles.readyTitle, narrow && styles.readyTitleNarrow]}>Welcome back, {name}.</Text>
            <Text style={styles.readySubtitle}>Your marketplace is connected and ready.</Text>
          </Animated.View>

          <Animated.View style={[styles.readySignals, featureStyle]}>
            {readySignals.map((item) => (
              <View key={item.label} style={styles.readySignal}>
                <Ionicons color={item.accent} name={item.icon} size={19} />
                <Text numberOfLines={1} style={styles.readySignalText}>{item.label}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

function ConnectionBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <View style={[styles.backdropLine, styles.backdropLineOne]} />
      <View style={[styles.backdropLine, styles.backdropLineTwo]} />
      <View style={[styles.backdropLine, styles.backdropLineThree]} />
      <View style={[styles.backdropNode, styles.backdropNodeOne]} />
      <View style={[styles.backdropNode, styles.backdropNodeTwo]} />
      <View style={[styles.backdropNode, styles.backdropNodeThree]} />
      <View style={[styles.cityBlock, styles.cityBlockOne]} />
      <View style={[styles.cityBlock, styles.cityBlockTwo]} />
      <View style={[styles.cityBlock, styles.cityBlockThree]} />
      <View style={[styles.cityBlock, styles.cityBlockFour]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    overflow: 'hidden',
    backgroundColor: palette.background,
    elevation: 10000,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.58 },
  backdropLine: { position: 'absolute', height: 2, backgroundColor: 'rgba(77,224,160,0.22)' },
  backdropLineOne: { top: '21%', right: '-8%', width: '52%', transform: [{ rotateZ: '-24deg' }] },
  backdropLineTwo: { top: '56%', left: '-14%', width: '58%', transform: [{ rotateZ: '28deg' }] },
  backdropLineThree: { right: '-8%', bottom: '17%', width: '60%', transform: [{ rotateZ: '18deg' }] },
  backdropNode: { position: 'absolute', width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: palette.green, backgroundColor: palette.background },
  backdropNodeOne: { top: '15%', right: '16%' },
  backdropNodeTwo: { top: '52%', left: '16%' },
  backdropNodeThree: { right: '18%', bottom: '13%', borderColor: palette.coral },
  cityBlock: { position: 'absolute', bottom: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.035)' },
  cityBlockOne: { left: 0, width: '20%', height: '16%' },
  cityBlockTwo: { left: '22%', width: '24%', height: '10%' },
  cityBlockThree: { right: '25%', width: '22%', height: '19%' },
  cityBlockFour: { right: 0, width: '23%', height: '13%' },
  openingLayout: { flex: 1, alignItems: 'center', paddingHorizontal: 22, paddingBottom: 22 },
  openingBrand: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: 112, height: 112 },
  logoCompact: { width: 86, height: 86 },
  openingCopy: { alignItems: 'center', gap: 3, marginTop: 8 },
  brandName: { color: palette.white, fontSize: 31, lineHeight: 37, fontWeight: '900' },
  brandNameNarrow: { fontSize: 27, lineHeight: 33 },
  openingTitle: { marginTop: 5, color: palette.green, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  openingSubtitle: { color: palette.whiteMuted, fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
  journey: { flex: 1, width: '100%', maxWidth: 360, minHeight: 260, justifyContent: 'center', marginTop: 12 },
  journeyCompact: { minHeight: 220, marginTop: 4 },
  routeLine: { position: 'absolute', top: '18%', bottom: '18%', left: 27, width: 2, backgroundColor: 'rgba(255,255,255,0.26)' },
  movingSignal: { position: 'absolute', top: '49%', left: 21, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: palette.background, backgroundColor: palette.coral },
  signalList: { gap: 15 },
  signalRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14 },
  signalIcon: { zIndex: 2, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 2, backgroundColor: palette.backgroundRaised },
  signalCopy: { flex: 1, minWidth: 0, gap: 2 },
  signalLabel: { color: palette.white, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  signalDetail: { color: palette.whiteMuted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  readyLayout: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 },
  readyBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readyLogo: { width: 54, height: 54 },
  readyBrandName: { color: palette.white, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  readyCenter: { width: '100%', alignItems: 'center', gap: 8 },
  readyCheck: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 41, borderWidth: 2, borderColor: palette.green, backgroundColor: palette.backgroundRaised },
  readyTitle: { maxWidth: 390, color: palette.white, fontSize: 30, lineHeight: 37, fontWeight: '900', textAlign: 'center' },
  readyTitleNarrow: { fontSize: 26, lineHeight: 32 },
  readySubtitle: { maxWidth: 320, color: palette.whiteMuted, fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  readySignals: { width: '100%', maxWidth: 400, minHeight: 76, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.20)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)' },
  readySignal: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  readySignalText: { color: palette.white, fontSize: 9, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
});
