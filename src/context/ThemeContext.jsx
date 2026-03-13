/**
 * ThemeContext.jsx
 * 다크모드 테마 상태 관리 컨텍스트.
 * theme 값: 'light' | 'dark' | 'system' (localStorage 'theme' 키에 저장)
 * system 선택 시 OS의 prefers-color-scheme를 자동 감지하여 적용.
 * document.documentElement에 data-theme 속성(DaisyUI)과 dark 클래스(Tailwind) 동시 설정.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export const ThemeContext = createContext();

/** localStorage 초기값 읽기 (없으면 'light') */
const getInitialTheme = () => {
  try {
    return localStorage.getItem("theme") || "light";
  } catch {
    return "light";
  }
};

/** OS 다크모드 감지 */
const getSystemIsDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** 실제 다크 여부 계산 */
const resolveIsDark = (theme) => {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return getSystemIsDark(); // 'system'
};

/** document에 테마 클래스/속성 적용 */
const applyTheme = (isDark) => {
  const root = document.documentElement;
  // DaisyUI data-theme 속성 설정
  root.setAttribute("data-theme", isDark ? "market-dark" : "market-light");
  // Tailwind dark: 접두사 대응 클래스 설정
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// eslint-disable-next-line react/prop-types
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  /** isDark: theme 값으로부터 파생된 실제 다크 여부 */
  const isDark = resolveIsDark(theme);

  /**
   * 테마 변경 핸들러.
   * localStorage에 저장 후 상태 업데이트.
   */
  const setTheme = useCallback((newTheme) => {
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      // localStorage 쓰기 실패 시 무시
    }
    setThemeState(newTheme);
  }, []);

  /** 테마 변경 시 document에 즉시 반영 */
  useEffect(() => {
    applyTheme(resolveIsDark(theme));
  }, [theme]);

  /** system 모드일 때 OS 테마 변경 감지 */
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      applyTheme(e.matches);
    };

    // 모던 브라우저는 addEventListener, 구형은 addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme]);

  const value = { theme, setTheme, isDark };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme 훅.
 * @returns {{ theme: string, setTheme: function, isDark: boolean }}
 */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme은 ThemeProvider 하위에서만 사용할 수 있습니다.");
  }
  return ctx;
};
