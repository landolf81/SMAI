/** Shared theme context and consumer hook, separate from the refreshable provider. */
import { createContext, useContext } from 'react';

export const ThemeContext = createContext();

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme은 ThemeProvider 하위에서만 사용할 수 있습니다.");
  }
  return ctx;
};
