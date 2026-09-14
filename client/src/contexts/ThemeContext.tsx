import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";

type ResolvedTheme = "light" | "dark";

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
      const stored = window.localStorage.getItem("theme");
      return stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : defaultTheme;
    }
    return defaultTheme;
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme !== "system") return theme;
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      if (
        !switchable ||
        (nextTheme !== "light" &&
          nextTheme !== "dark" &&
          nextTheme !== "system")
      )
        return;
      setSelectedTheme(nextTheme);
    },
    [switchable]
  );

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (nextTheme: Theme) => {
      const resolved: ResolvedTheme =
        nextTheme === "system" ? (media.matches ? "dark" : "light") : nextTheme;
      root.classList.toggle("dark", resolved === "dark");
      root.dataset.theme = nextTheme;
      root.style.colorScheme = resolved;
      setResolvedTheme(resolved);
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
      window.localStorage.setItem("theme", theme);
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
