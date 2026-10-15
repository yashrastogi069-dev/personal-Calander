import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { becameTrue, dampUpward, dataStartMs, EASE_DATA, easeOutCubic, easeOutQuart, EASE_OUT, ENTER, EXIT, GLIDE, MOTION_MS, prefersReducedMotion, SHEET, shouldDismissSheet } from "./motion";

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

  it("eases data motion on the gentler cubic curve, matching --pc-ease-data", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
    expect(easeOutCubic(0.5)).toBeLessThan(easeOutQuart(0.5));
    expect(EASE_DATA).toEqual([0.33, 1, 0.68, 1]);
    expect(read("design/tokens-v2.css")).toContain("--pc-ease-data: cubic-bezier(.33, 1, .68, 1)");
  });

  it("keeps the glide and dialog entrance in the 380-600ms entrance budget with the token ease", () => {
    for (const transition of [GLIDE, ENTER]) {
      expect(transition.duration).toBeGreaterThanOrEqual(0.38);
      expect(transition.duration).toBeLessThanOrEqual(0.6);
    }
    expect(EXIT.duration).toBeLessThan(ENTER.duration);
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
    expect(SHEET.duration).toBeGreaterThanOrEqual(0.38);
    expect(SHEET.duration).toBeLessThanOrEqual(0.6);
    expect(read("design/tokens-v2.css")).toContain("--pc-ease-sheet: cubic-bezier(.32, .72, 0, 1)");
  });

  it("holds every motion tier inside the owner's timing budget", () => {
    // Taps and press feedback.
    for (const ms of [MOTION_MS.press, MOTION_MS.fast, MOTION_MS.base]) {
      expect(ms).toBeGreaterThanOrEqual(120);
      expect(ms).toBeLessThanOrEqual(220);
    }
    // Entrances and their stagger.
    for (const ms of [MOTION_MS.enter, MOTION_MS.pop, MOTION_MS.glide, MOTION_MS.sheet]) {
      expect(ms).toBeGreaterThanOrEqual(380);
      expect(ms).toBeLessThanOrEqual(600);
    }
    expect(MOTION_MS.stagger).toBeGreaterThanOrEqual(60);
    expect(MOTION_MS.stagger).toBeLessThanOrEqual(90);
    // Data motion (count-ups, rings, bars) and the digit roll.
    expect(MOTION_MS.data).toBeGreaterThanOrEqual(1100);
    expect(MOTION_MS.data).toBeLessThanOrEqual(1600);
    expect(MOTION_MS.tick).toBeGreaterThanOrEqual(300);
    expect(MOTION_MS.tick).toBeLessThanOrEqual(420);
  });

  it("mirrors every MOTION_MS value in tokens-v2.css", () => {
    const css = read("design/tokens-v2.css");
    const tokens: Record<keyof typeof MOTION_MS, string> = {
      press: "--pc-dur-press", fast: "--pc-dur-fast", base: "--pc-dur-base", exit: "--pc-dur-exit", enter: "--pc-dur-enter",
      pop: "--pc-dur-pop", glide: "--pc-dur-glide", tick: "--pc-dur-tick", sheet: "--pc-dur-sheet", data: "--pc-dur-data",
      dataDelay: "--pc-data-delay", stagger: "--pc-stagger",
    };
    for (const [key, token] of Object.entries(tokens)) expect(css, token).toContain(`${token}: ${MOTION_MS[key as keyof typeof MOTION_MS]}ms;`);
  });

  it("starts a card's count-up with its ring: after the rise, one stagger step per card, capped at 8", () => {
    expect(dataStartMs(0)).toBe(MOTION_MS.dataDelay);
    expect(dataStartMs(3)).toBe(MOTION_MS.dataDelay + 3 * MOTION_MS.stagger);
    expect(dataStartMs(20)).toBe(dataStartMs(8));
    expect(dataStartMs(-1)).toBe(dataStartMs(0));
    expect(read("features/dashboard/dashboard.css")).toContain("--pc-data-start: calc(var(--pc-data-delay) + min(var(--pc-i, 0), 8) * var(--pc-stagger));");
  });

  it("drifts the hero colour on a calm 8-12s there-and-back cycle", () => {
    const leg = Number(/--pc-dur-ambient:\s*([\d.]+)s;/.exec(read("design/tokens-v2.css"))?.[1]);
    expect(leg * 2).toBeGreaterThanOrEqual(8);
    expect(leg * 2).toBeLessThanOrEqual(12);
    const tint = Number(/pc-dash-aurora-tint calc\(var\(--pc-dur-ambient\) \* ([\d.]+)\)/.exec(read("features/dashboard/dashboard.css"))?.[1]);
    expect(leg * 2 * tint).toBeLessThanOrEqual(12);
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
      [".pc-dash-hero::before", ".pc-dash-hero::after", ".pc-dash-live", ".is-celebrating", ".pc-dash-tick", ".pc-dash-bar-bubble", ".pc-dash-hero-check", ".pc-dash-focus-body.pc-blur-in", ".pc-dash-strip-marker"],
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
