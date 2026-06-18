import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';

import { usePersistentState } from '../hooks/usePersistentState';
import { darkColors, lightColors, type AppColors, type ThemeMode } from './index';

type ThemeContextValue = {
  colors: AppColors;
  isDarkMode: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = usePersistentState<ThemeMode>('urbanconnect.themeMode', 'light');
  const isDarkMode = mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDarkMode ? darkColors : lightColors,
      isDarkMode,
      mode,
      toggleTheme: () => setMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark')),
    }),
    [isDarkMode, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }

  return context;
}
