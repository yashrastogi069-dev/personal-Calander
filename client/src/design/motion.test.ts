import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { becameTrue, dampUpward, easeOutQuart, EASE_OUT, GLIDE, prefersReducedMotion, SHEET, shouldDismissSheet } from "./motion";

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

/** Bodies of every `@media (prefers-reduced-motion: reduce)` block in a stylesheet, joined. */
function reducedMotionCss(css: string): string {
  const bodies: string[] = [];
  const marker = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  for (let match = marker.exec(css); match; match = marker.exec(css)) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (depth > 0 && index < css.length) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    bodies.push(css.slice(start, index - 1));
  }
  return bodies.join("\n");
}

describe("motion helpers", () => {
  it("celebrates only a false-to-true flip", () => {
    expect(becameTrue(false, true)).toBe(true);
    expect(becameTrue(true, true)).toBe(false);
    expect(becameTrue(true, false)).toBe(false);
    expect(becameTrue(false, false)).toBe(false);
  });

  it("eases out from 0 to 1", () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
    expect(easeOutQuart(0.5)).toBeGreaterThan(0.9);
  });

  it("keeps the glide inside the 300ms interaction budget with the token ease", () => {
    expect(GLIDE.duration).toBeLessThanOrEqual(0.3);
    expect(EASE_OUT).toEqual([0.23, 1, 0.32, 1]);
    expect(read("design/tokens-v2.css")).toContain("--pc-ease: cubic-bezier(.23, 1, .32, 1)");
  });

  it("dismisses a sheet on a 0.11 px/ms flick or a long drag, never on an upward pull", () => {
    expect(shouldDismissSheet(20, 120, 400)).toBe(true);
    expect(shouldDismissSheet(20, 100, 400)).toBe(false);
    expect(shouldDismissSheet(110, 0, 400)).toBe(true);
    expect(shouldDismissSheet(-40, 900, 400)).toBe(false);
    expect(dampUpward(-80)).toBeGreaterThan(-80);
    expect(dampUpward(-80)).toBeLessThan(0);
    expect(dampUpward(30)).toBe(30);
    expect(SHEET.duration).toBeLessThanOrEqual(0.3);
    expect(read("design/tokens-v2.css")).toContain("--pc-ease-sheet: cubic-bezier(.32, .72, 0, 1)");
  });

  it("treats a missing window as reduced motion", () => {
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("reduced motion coverage", () => {
  const cases: Array<[string, string[]]> = [
    ["design/tokens-v2.css", [".pc-live::after", ".pc-icon-pop", "--pc-dur-draw: 0ms", "--pc-dur-celebrate: 0ms"]],
    [
      "features/dashboard/dashboard.css",
      [".pc-dash-hero::before", ".pc-dash-live", ".is-celebrating", ".pc-dash-tick", ".pc-dash-bar-bubble", ".pc-dash-hero-check", ".pc-dash-focus-body.pc-blur-in", ".pc-dash-strip-marker"],
    ],
    ["features/focus/focus.css", [".pc-dial-xs-live::after", ".pc-digit-roll", ".pc-dial.is-flash .pc-dial-arc", ".pc-focus-pill"]],
    ["components/premium/premium.css", [".pc-choice-reveal"]],
    ["features/shell/premium-shell.css", [".pc-phone-capture > svg",'.pc-palette[data-state="open"]', '.pc-palette[data-state="closed"]']],
  ];
  for (const [file, names] of cases) {
    it(`${file} switches off each new animation under prefers-reduced-motion`, () => {
      const reduced = reducedMotionCss(read(file));
      expect(reduced.length).toBeGreaterThan(0);
      for (const name of names) expect(reduced, name).toContain(name);
    });
  }

  it("keeps every infinite animation behind a reduced-motion opt-out", () => {
    for (const file of ["design/tokens-v2.css", "features/dashboard/dashboard.css", "features/shell/premium-shell.css", "features/focus/focus.css", "components/premium/premium.css"]) {
      const css = read(file);
      const reduced = reducedMotionCss(css);
      const infinite = [...css.matchAll(/animation:\s*([a-z0-9-]+)[^;]*\binfinite\b/g)].map(match => match[1]);
      for (const name of infinite) expect(reduced, `${file}: ${name}`).toMatch(/animation:\s*none/);
    }
  });
});
