import { useAppearance } from '../../shared/theme/react';

export function useTheme() {
  const [theme, setTheme] = useAppearance();

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark'
  };
}
