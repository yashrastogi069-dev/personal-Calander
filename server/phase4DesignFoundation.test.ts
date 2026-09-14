import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
});
