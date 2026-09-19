import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme !== "system") return theme;
  return prefersDark ? "dark" : "light";
}

export function getThemeApplication(theme: Theme, prefersDark: boolean) {
  const resolvedTheme = resolveTheme(theme, prefersDark);
  return {
    theme,
    resolvedTheme,
    dark: resolvedTheme === "dark",
    colorScheme: resolvedTheme,
  };
}

export function readStoredTheme(
  read: () => unknown,
  fallback: Theme
): Theme {
  try {
    const stored = read();
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : fallback;
  } catch {
    return fallback;
  }
}

export function persistTheme(
  write: (theme: Theme) => void,
  theme: unknown
): boolean {
  if (!isTheme(theme)) return false;
  try {
    write(theme);
    return true;
  } catch {
    return false;
  }
}

export function selectTheme(
  current: Theme,
  requested: unknown,
  switchable: boolean
): Theme {
  return switchable && isTheme(requested) ? requested : current;
}

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setSelectedTheme] = useState<Theme>(() => {
    if (switchable && typeof window !== "undefined") {
      return readStoredTheme(() => window.localStorage.getItem("theme"), defaultTheme);
    }
    return defaultTheme;
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return resolveTheme(theme, prefersDark);
  });

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      if (!switchable || !isTheme(nextTheme)) return;
      setSelectedTheme(selectTheme(theme, nextTheme, switchable));
    },
    [switchable, theme]
  );

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (nextTheme: Theme) => {
      const application = getThemeApplication(nextTheme, media.matches);
      root.classList.toggle("dark", application.dark);
      root.dataset.theme = application.theme;
      root.style.colorScheme = application.colorScheme;
      setResolvedTheme(application.resolvedTheme);
    };
    apply(theme);
    const onSystemChange = () => {
      if (theme === "system") apply("system");
    };
    media.addEventListener?.("change", onSystemChange);
    return () => media.removeEventListener?.("change", onSystemChange);
  }, [theme]);

  useEffect(() => {
    if (switchable && typeof window !== "undefined")
      persistTheme(nextTheme => window.localStorage.setItem("theme", nextTheme), theme);
  }, [theme, switchable]);

  const toggleTheme = useMemo(
    () =>
      switchable
        ? () =>
            setSelectedTheme(previousTheme =>
              previousTheme === "light" ? "dark" : "light"
            )
        : undefined,
    [switchable]
  );

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      switchable,
    }),
    [resolvedTheme, setTheme, switchable, theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
