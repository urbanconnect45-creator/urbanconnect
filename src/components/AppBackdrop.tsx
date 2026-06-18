import { StyleSheet, View } from 'react-native';

import type { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

const horizontalLines = ['10%', '24%', '38%', '52%', '66%', '80%'] as const;
const verticalLines = ['8%', '22%', '36%', '50%', '64%', '78%', '92%'] as const;

export function AppBackdrop() {
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors, isDarkMode);

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.base} />
      <View style={[styles.orb, styles.orbOne]} />
      <View style={[styles.orb, styles.orbTwo]} />
      <View style={[styles.orb, styles.orbThree]} />
      <View style={styles.diagonalBand} />
      <View style={styles.mesh}>
        {horizontalLines.map((top) => (
          <View key={`row-${top}`} style={[styles.horizontalLine, { top }]} />
        ))}
        {verticalLines.map((left) => (
          <View key={`column-${left}`} style={[styles.verticalLine, { left }]} />
        ))}
      </View>
      <View style={styles.bottomGlow} />
    </View>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean) {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    base: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
    },
    orb: {
      position: 'absolute',
      borderRadius: 999,
    },
    orbOne: {
      top: -140,
      right: -70,
      height: 320,
      width: 320,
      backgroundColor: isDarkMode ? 'rgba(255, 154, 110, 0.15)' : 'rgba(240, 132, 92, 0.18)',
    },
    orbTwo: {
      top: '28%',
      left: -120,
      height: 280,
      width: 280,
      backgroundColor: isDarkMode ? 'rgba(142, 216, 230, 0.12)' : 'rgba(58, 144, 158, 0.16)',
    },
    orbThree: {
      bottom: -150,
      right: '14%',
      height: 360,
      width: 360,
      backgroundColor: isDarkMode ? 'rgba(215, 190, 115, 0.1)' : 'rgba(196, 164, 95, 0.12)',
    },
    diagonalBand: {
      position: 'absolute',
      top: '12%',
      left: '-14%',
      right: '-14%',
      height: 180,
      transform: [{ rotate: '-10deg' }],
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.36)',
    },
    mesh: {
      ...StyleSheet.absoluteFillObject,
      opacity: isDarkMode ? 0.6 : 0.45,
    },
    horizontalLine: {
      position: 'absolute',
      left: '-8%',
      right: '-8%',
      height: 1,
      backgroundColor: colors.subtleLine,
    },
    verticalLine: {
      position: 'absolute',
      top: '-8%',
      bottom: '-8%',
      width: 1,
      backgroundColor: colors.subtleLine,
    },
    bottomGlow: {
      position: 'absolute',
      left: '12%',
      right: '12%',
      bottom: -90,
      height: 220,
      borderRadius: 999,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.44)',
    },
  });
}
