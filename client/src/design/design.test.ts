import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_TONES, resolveCategoryTone, resolveCategoryTones } from "./categoryTone";
import { formatMinutes, timeChipState } from "./timeFormat";

describe("formatMinutes", () => {
  it("formats minutes, hours and mixed durations", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(65)).toBe("1h 5m");
    expect(formatMinutes(-5)).toBe("0m");
  });
});

describe("timeChipState", () => {
  it("returns null without planned or actual time", () => {
    expect(timeChipState(null, null)).toBeNull();
    expect(timeChipState(0, 0)).toBeNull();
  });
  it("distinguishes planned, tracked, on and over estimate", () => {
    expect(timeChipState(45, null)).toBe("planned");
    expect(timeChipState(null, 30)).toBe("tracked");
    expect(timeChipState(60, 72)).toBe("on-estimate");
    expect(timeChipState(60, 73)).toBe("over-estimate");
  });
});

describe("resolveCategoryTone", () => {
  it("returns neutral without a category", () => {
    expect(resolveCategoryTone(null)).toBe("neutral");
  });
  it("snaps a stored colour to the nearest slot by hue", () => {
    expect(resolveCategoryTone({ id: "a", name: "Anything", color: "#3366ff" })).toBe("work");
    expect(resolveCategoryTone({ id: "b", name: "Anything", color: "#10b981" })).toBe("health");
    expect(resolveCategoryTone({ id: "c", name: "Anything", color: "#f59e0b" })).toBe("learning");
    expect(resolveCategoryTone({ id: "d", name: "Anything", color: "#8b5cf6" })).toBe("personal");
    expect(resolveCategoryTone({ id: "e", name: "Anything", color: "#ec4899" })).toBe("social");
  });
  it("falls back to name keywords on word boundaries for grey or missing colours", () => {
    expect(resolveCategoryTone({ id: "x", name: "Gym and running", color: "#808080" })).toBe("health");
    expect(resolveCategoryTone({ id: "y", name: "University", color: null })).toBe("learning");
    // "brunch" must not match the "run" keyword.
    const brunch = resolveCategoryTone({ id: "z", name: "Brunch", color: null });
    expect(brunch).toBe(resolveCategoryTone({ id: "z", name: "Qqq", color: null }));
  });
  it("is stable for the same id", () => {
    const category = { id: "stable-id", name: "Misc", color: null };
    expect(resolveCategoryTone(category)).toBe(resolveCategoryTone({ ...category }));
  });
});

describe("resolveCategoryTones", () => {
  it("gives colliding categories distinct slots by sortOrder", () => {
    const tones = resolveCategoryTones([
      { id: "second", name: "Clients", color: "#3b82f6", sortOrder: 1 },
      { id: "first", name: "Job", color: "#2563eb", sortOrder: 0 },
    ]);
    expect(tones.get("first")).toBe("work");
    expect(tones.get("second")).not.toBe("work");
  });
  it("uses all five slots before repeating", () => {
    const categories = Array.from({ length: 6 }, (_, index) => ({ id: `c${index}`, name: "Blue", color: "#2f6fe4", sortOrder: index }));
    const tones = resolveCategoryTones(categories);
    const firstFive = new Set(categories.slice(0, 5).map(category => tones.get(category.id)));
    expect(firstFive.size).toBe(CATEGORY_TONES.length);
    expect(tones.get("c5")).toBe("work");
  });
});

// WCAG relative luminance contrast.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const tokensCss = readFileSync(resolve(__dirname, "tokens-v2.css"), "utf8");
function block(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(`${selector} {`);
  const body = tokensCss.slice(start, tokensCss.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/--(pc-[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(match => [match[1], match[2].toLowerCase()]));
}
const THEMES = {
  light: { tokens: block("html:root"), surfaces: { card: "#ffffff", card2: "#f5f7fb" } },
  dark: { tokens: block("html:root.dark"), surfaces: { card: "#19273a", card2: "#203149" } },
};

describe("v2 palette contrast", () => {
  for (const [theme, { tokens, surfaces }] of Object.entries(THEMES)) {
    for (const tone of [...CATEGORY_TONES, "neutral"]) {
      it(`${theme} ${tone}: chip ink on soft is at least 4.5:1`, () => {
        expect(contrast(tokens[`pc-cat-${tone}-ink`], tokens[`pc-cat-${tone}-soft`])).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const tone of CATEGORY_TONES) {
      it(`${theme} ${tone}: base mark on card and card-2 is at least 3:1`, () => {
        expect(contrast(tokens[`pc-cat-${tone}`], surfaces.card)).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens[`pc-cat-${tone}`], surfaces.card2)).toBeGreaterThanOrEqual(3);
      });
    }
    for (const status of ["ok", "risk", "off"]) {
      it(`${theme} status ${status}: text on soft is at least 4.5:1`, () => {
        expect(contrast(tokens[`pc-${status}`], tokens[`pc-${status}-soft`])).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`${theme}: faint marks hold 3:1 on card`, () => {
      expect(contrast(tokens["pc-faint"], surfaces.card)).toBeGreaterThanOrEqual(3);
    });
  }
});
