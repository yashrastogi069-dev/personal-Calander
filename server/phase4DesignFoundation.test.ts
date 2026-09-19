import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Toaster } from "../client/src/components/ui/sonner";
import * as ThemeModule from "../client/src/contexts/ThemeContext";
import * as PlannerSheetModule from "../client/src/features/shell/PlannerSheet";

const root = path.resolve(import.meta.dirname, "..");

function source(relativePath: string) {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function declarationsFor(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))?.[1] ?? ""
  );
}

function declarationMap(declarations: string) {
  return Object.fromEntries(
    [...declarations.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)].map(match => [
      match[1],
      match[2].trim(),
    ])
  );
}

function selectorSpecificity(selector: string) {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classesAndPseudoClasses =
    selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length ?? 0;
  const elements = selector.match(/\b(?:html|body)\b/g)?.length ?? 0;
  return ids * 100 + classesAndPseudoClasses * 10 + elements;
}

function rootSelectorMatches(selector: string, dark: boolean) {
  const candidate = selector.trim();
  if (!candidate || /[\s>+~]/.test(candidate) || candidate.startsWith("@")) return false;
  if (candidate.includes(".dark") && !dark) return false;
  const remainder = candidate
    .replace(/^html/, "")
    .replace(/:root/g, "")
    .replace(/\.dark/g, "");
  return remainder === "" && (candidate.includes(":root") || candidate.startsWith("html") || candidate === ".dark");
}

function resolvedRootProperties(css: string, dark: boolean) {
  const cascaded = new Map<string, { specificity: number; order: number; value: string }>();
  let order = 0;

  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = declarationMap(rule[2]);
    for (const selector of rule[1].split(",")) {
      if (!rootSelectorMatches(selector, dark)) continue;
      const specificity = selectorSpecificity(selector);
      for (const [name, value] of Object.entries(declarations)) {
        if (!name.startsWith("--")) continue;
        const existing = cascaded.get(name);
        if (!existing || specificity > existing.specificity || (specificity === existing.specificity && order > existing.order)) {
          cascaded.set(name, { specificity, order, value });
        }
      }
      order += 1;
    }
  }

  const resolve = (name: string, seen = new Set<string>()): string => {
    if (seen.has(name)) return "";
    const value = cascaded.get(name)?.value ?? "";
    const nextSeen = new Set(seen).add(name);
    return value.replace(/var\((--[\w-]+)\)/g, (_match, variable: string) => resolve(variable, nextSeen));
  };

  return new Proxy({} as Record<string, string>, {
    get: (_target, property: string) => resolve(property),
  });
}

type ThemeContract = {
  isTheme: (value: unknown) => boolean;
  resolveTheme: (theme: "light" | "dark" | "system", prefersDark: boolean) => "light" | "dark";
  getThemeApplication: (
    theme: "light" | "dark" | "system",
    prefersDark: boolean
  ) => { theme: "light" | "dark" | "system"; resolvedTheme: "light" | "dark"; dark: boolean; colorScheme: "light" | "dark" };
  readStoredTheme: (read: () => unknown, fallback: "light" | "dark" | "system") => "light" | "dark" | "system";
  persistTheme: (write: (theme: "light" | "dark" | "system") => void, theme: unknown) => boolean;
  selectTheme: (
    current: "light" | "dark" | "system",
    requested: unknown,
    switchable: boolean
  ) => "light" | "dark" | "system";
};

const themeContract = ThemeModule as unknown as Partial<ThemeContract>;

type FocusContract = {
  isEligibleReturnFocusTarget: (element: HTMLElement | null) => boolean;
  restorePlannerSheetFocus: (
    event: { preventDefault: () => void },
    element: HTMLElement | null
  ) => boolean;
};

const focusContract = PlannerSheetModule as unknown as Partial<FocusContract>;

const tokenPath = "client/src/features/shell/phase4-tokens.css";
const sheetPath = "client/src/features/shell/PlannerSheet.tsx";
const sheetCssPath = "client/src/features/shell/planner-sheet.css";

describe("Phase 4 design foundation", () => {
  it("ships the semantic token and PlannerSheet files", () => {
    expect(
      [tokenPath, sheetPath, sheetCssPath].filter(
        file => !existsSync(path.join(root, file))
      )
    ).toEqual([]);
  });

  it("maps the selected A-light and C-dark palettes to state-neutral semantic tokens", () => {
    const css = source(tokenPath);
    const light = declarationsFor(css, "html:root");
    const dark = declarationsFor(css, "html:root.dark");
    const expectedLight = {
      surface: "#ede9df",
      "surface-elevated": "#fffdf8",
      ink: "#18211f",
      "ink-muted": "#56625e",
      border: "#cbd2cb",
      accent: "#286b5e",
      selection: "#dbeae3",
      completion: "#246650",
      warning: "#85501e",
      destructive: "#a33f3f",
      "focus-ring": "#1775a4",
    } as const;
    const expectedDark = {
      surface: "#0c1317",
      "surface-elevated": "#17242a",
      ink: "#f1ebdf",
      "ink-muted": "#aab5b3",
      border: "#304149",
      accent: "#70bab2",
      selection: "#183b3b",
      completion: "#83c4a4",
      warning: "#e1ad6b",
      destructive: "#ee8b82",
      "focus-ring": "#8bd4df",
    } as const;

    for (const [name, value] of Object.entries(expectedLight)) {
      expect(light).toMatch(new RegExp(`--${name}:\\s*${value}`, "i"));
    }
    for (const [name, value] of Object.entries(expectedDark)) {
      expect(dark).toMatch(new RegExp(`--${name}:\\s*${value}`, "i"));
    }
    expect(css.match(/(?:^|\n)html:root\s*\{/g)).toHaveLength(1);
    expect(css.match(/(?:^|\n)html:root\.dark\s*\{/g)).toHaveLength(1);
    expect(css).not.toMatch(
      /--[\w-]*(?:todo|doing|done|in-progress|completed)[\w-]*\s*:/i
    );
  });

  it("keeps semantic aliases authoritative after the ordered legacy cascade", () => {
    const tokens = source(tokenPath);
    const indexCss = source("client/src/index.css");
    const expandedCss = indexCss.replace(
      /@import\s+["']\.\/features\/shell\/phase4-tokens\.css["'];/,
      tokens
    ).replace(/@import\s+[^;]+;/g, "");
    const light = resolvedRootProperties(expandedCss, false);
    const dark = resolvedRootProperties(expandedCss, true);

    expect({
      background: light["--background"],
      foreground: light["--foreground"],
      primary: light["--primary"],
      border: light["--border"],
      destructive: light["--destructive"],
      ring: light["--ring"],
    }).toEqual({
      background: "#ede9df",
      foreground: "#18211f",
      primary: "#286b5e",
      border: "#cbd2cb",
      destructive: "#a33f3f",
      ring: "#1775a4",
    });
    expect({
      background: dark["--background"],
      foreground: dark["--foreground"],
      card: dark["--card"],
      primary: dark["--primary"],
      border: dark["--border"],
      destructive: dark["--destructive"],
      ring: dark["--ring"],
    }).toEqual({
      background: "#0c1317",
      foreground: "#f1ebdf",
      card: "#17242a",
      primary: "#70bab2",
      border: "#304149",
      destructive: "#ee8b82",
      ring: "#8bd4df",
    });
  });

  it("preserves the exact R20 lane palette in its existing scoped rules", () => {
    const prototypeCss = source(
      "client/src/features/phase4-prototypes/phase4-prototypes.css"
    );
    const productionCss = source("client/src/index.css");

    for (const declaration of [
      "--prototype-todo:#2a405d",
      "--prototype-todo-end:#15283f",
      "--prototype-doing:#155b59",
      "--prototype-doing-end:#0b393b",
      "--prototype-done:#1d4b3d",
      "--prototype-done-end:#102f27",
    ])
      expect(prototypeCss).toContain(declaration);
    for (const declaration of [
      "--lane-surface:#2a405d",
      "--lane-depth:#15283f",
      "--lane-surface:#155b59",
      "--lane-depth:#0b393b",
      "--lane-surface:#1d4b3d",
      "--lane-depth:#102f27",
    ])
      expect(productionCss).toContain(declaration);
  });

  it("imports the token foundation once and retains one 16px body baseline", () => {
    const indexCss = source("client/src/index.css");

    expect(
      indexCss.match(
        /@import\s+["']\.\/features\/shell\/phase4-tokens\.css["'];/g
      )
    ).toHaveLength(1);
    expect(indexCss).toMatch(/body\s*\{[^}]*font-size:\s*16px/);
    expect(source(tokenPath)).toContain("--font-size-secondary: 14px");
    expect(indexCss.match(/:root\s*,\s*\.dark\s*\{/g)).toHaveLength(3);
  });

  it("uses the selected 180ms sheet motion with a near-immediate reduced-motion fallback", () => {
    const tokens = source(tokenPath);
    const sheetCss = source(sheetCssPath);

    expect(tokens).toContain("--motion-sheet: 180ms");
    expect(tokens).toContain("--motion-sheet-reduced: 0.00001s");
    expect(sheetCss).toContain("var(--motion-sheet)");
    expect(sheetCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(sheetCss).toContain("var(--motion-sheet-reduced)");
  });

  it("exposes a compatible three-state theme context with system change cleanup", () => {
    const theme = source("client/src/contexts/ThemeContext.tsx");

    expect(theme).toContain('type Theme = "light" | "dark" | "system"');
    expect(theme).toMatch(/resolvedTheme:\s*ResolvedTheme/);
    expect(theme).toMatch(/setTheme:\s*\(theme:\s*Theme\)\s*=>\s*void/);
    expect(theme).toMatch(/toggleTheme\?:\s*\(\)\s*=>\s*void/);
    expect(theme).toContain("switchable: boolean");
    expect(theme).toMatch(
      /stored === "light"\s*\|\|\s*stored === "dark"\s*\|\|\s*stored === "system"/
    );
    expect(theme).toContain(
      'media.addEventListener?.("change", onSystemChange)'
    );
    expect(theme).toContain(
      'media.removeEventListener?.("change", onSystemChange)'
    );
    expect(theme).toContain('if (theme !== "system") return theme');
    expect(theme).toMatch(/if\s*\(\s*!switchable\s*\|\|/);
    expect(theme).not.toMatch(/planner|workspace|indexedDB|trpc|supabase/i);
  });

  it("validates, selects, and resolves theme values through production helpers", () => {
    expect(typeof themeContract.isTheme).toBe("function");
    expect(typeof themeContract.resolveTheme).toBe("function");
    expect(typeof themeContract.getThemeApplication).toBe("function");
    expect(typeof themeContract.selectTheme).toBe("function");
    if (!themeContract.isTheme || !themeContract.resolveTheme || !themeContract.getThemeApplication || !themeContract.selectTheme) return;

    expect(["light", "dark", "system"].map(themeContract.isTheme)).toEqual([true, true, true]);
    expect(["", "auto", null, 1].map(themeContract.isTheme)).toEqual([false, false, false, false]);
    expect(themeContract.selectTheme("light", "dark", true)).toBe("dark");
    expect(themeContract.selectTheme("light", "auto", true)).toBe("light");
    expect(themeContract.selectTheme("light", "dark", false)).toBe("light");
    expect(themeContract.resolveTheme("system", false)).toBe("light");
    expect(themeContract.resolveTheme("system", true)).toBe("dark");
    expect(themeContract.resolveTheme("dark", false)).toBe("dark");
    expect(themeContract.getThemeApplication("system", true)).toEqual({
      theme: "system",
      resolvedTheme: "dark",
      dark: true,
      colorScheme: "dark",
    });
  });

  it("falls back safely when theme storage is invalid or denied", () => {
    expect(typeof themeContract.readStoredTheme).toBe("function");
    expect(typeof themeContract.persistTheme).toBe("function");
    if (!themeContract.readStoredTheme || !themeContract.persistTheme) return;

    expect(themeContract.readStoredTheme(() => "dark", "system")).toBe("dark");
    expect(themeContract.readStoredTheme(() => "auto", "system")).toBe("system");
    expect(themeContract.readStoredTheme(() => { throw new Error("denied"); }, "light")).toBe("light");

    let stored = "";
    expect(themeContract.persistTheme(value => { stored = value; }, "system")).toBe(true);
    expect(stored).toBe("system");
    expect(themeContract.persistTheme(() => { stored = "invalid"; }, "auto")).toBe(false);
    expect(stored).toBe("system");
    expect(themeContract.persistTheme(() => { throw new Error("denied"); }, "dark")).toBe(false);
  });

  it("renders Sonner with the custom provider's resolved theme", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeModule.ThemeProvider, {
        defaultTheme: "dark",
        children: createElement(Toaster),
      })
    );

    expect(html).toContain('data-sonner-theme="dark"');
  });

  it("enables system switching without duplicating the authenticated boundary", () => {
    const app = source("client/src/App.tsx");

    expect(app).toMatch(
      /<ThemeProvider\s+defaultTheme="system"\s+switchable\s*>/
    );
    expect(app.match(/<AuthenticatedPlanner>/g)).toHaveLength(1);
  });

  it("provides an explicitly labelled, focus-managed Radix PlannerSheet", () => {
    const sheet = source(sheetPath);
    const css = source(sheetCssPath);

    for (const prop of [
      "open",
      "title",
      "description",
      "onOpenChange",
      "returnFocusRef",
      "children",
      "footer",
    ]) {
      expect(sheet).toMatch(new RegExp(`\\b${prop}\\b`));
    }
    for (const primitive of [
      "Dialog",
      "DialogContent",
      "DialogTitle",
      "DialogDescription",
      "DialogClose",
    ]) {
      expect(sheet).toContain(primitive);
    }
    expect(sheet).toContain("onOpenAutoFocus");
    expect(sheet).toContain("onCloseAutoFocus");
    expect(sheet).toContain("returnFocusRef.current");
    expect(sheet).toContain("isConnected");
    expect(sheet).toContain('aria-label="Close"');
    expect(css).toMatch(/\.planner-sheet-body\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(
      /\.planner-sheet-footer\s*\{[^}]*safe-area-inset-bottom/
    );
    expect(css).toMatch(
      /\.planner-sheet-close\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/
    );
    expect(css).toMatch(
      /\.planner-sheet-description\s*\{[^}]*font-size:\s*var\(--font-size-secondary\)/
    );
    expect(css).toContain("100dvh");
  });

  it("resets Tailwind's individual translation while retaining viewport anchoring", () => {
    const css = source(sheetCssPath);
    const declarations = declarationMap(declarationsFor(css, ".planner-sheet-content"));

    expect(declarations.translate).toBe("none");
    expect(declarations.transform).toBe("none");
    expect(declarations.inset).toBe("0");
    expect(declarations.top).toBe("0");
    expect(declarations.left).toBe("0");
    expect(declarations.width).toBe("100vw");
    expect(declarations.height).toBe("100dvh");
  });

  it("restores focus only to a connected, visible, enabled focus target", () => {
    expect(typeof focusContract.isEligibleReturnFocusTarget).toBe("function");
    expect(typeof focusContract.restorePlannerSheetFocus).toBe("function");
    if (!focusContract.isEligibleReturnFocusTarget || !focusContract.restorePlannerSheetFocus) return;

    const target = (overrides: Record<string, unknown> = {}) => ({
      isConnected: true,
      hidden: false,
      disabled: false,
      getAttribute: () => null,
      getClientRects: () => [{ width: 44, height: 44 }],
      matches: () => true,
      closest: () => null,
      focus: () => undefined,
      ...overrides,
    }) as unknown as HTMLElement;

    for (const invalid of [
      target({ isConnected: false }),
      target({ hidden: true }),
      target({ disabled: true }),
      target({ getAttribute: (name: string) => name === "aria-disabled" ? "true" : null }),
      target({ getClientRects: () => [] }),
      target({ matches: () => false }),
      target({ closest: () => ({ inert: true }) }),
    ]) expect(focusContract.isEligibleReturnFocusTarget(invalid)).toBe(false);

    let prevented = false;
    let focused = false;
    const validTarget = target({ focus: () => { focused = true; } });
    expect(focusContract.restorePlannerSheetFocus({ preventDefault: () => { prevented = true; } }, validTarget)).toBe(true);
    expect({ prevented, focused }).toEqual({ prevented: true, focused: true });

    prevented = false;
    expect(focusContract.restorePlannerSheetFocus({ preventDefault: () => { prevented = true; } }, target({ hidden: true }))).toBe(false);
    expect(prevented).toBe(false);
  });
});
