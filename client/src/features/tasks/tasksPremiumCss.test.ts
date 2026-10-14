// Source-level guards for the D3 stylesheets: every animation has a reduced-motion opt-out, motion uses
// tokens (no one-off durations on transitions), and nothing reaches for green literals or `transition: all`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const files = {
  tasks: readFileSync(resolve(root, "features/tasks/tasks-premium.css"), "utf8"),
  inspector: readFileSync(resolve(root, "features/tasks/task-detail-inspector.css"), "utf8"),
};
const premium = readFileSync(resolve(root, "components/premium/premium.css"), "utf8");
const d3Premium = premium.slice(premium.indexOf("/* ---------- D3:"));

const REDUCED = "@media (prefers-reduced-motion: reduce) {";

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function split(raw: string) {
  const css = stripComments(raw);
  const at = css.lastIndexOf(REDUCED);
  return at < 0 ? { main: css, reduced: "" } : { main: css.slice(0, at), reduced: css.slice(at) };
}

function selectorsWhere(css: string, test: (body: string) => boolean) {
  const out: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!test(match[2])) continue;
    for (const selector of match[1].split(",")) out.push(selector.replace(/\s+/g, " ").trim());
  }
  return out.filter(selector => selector && !selector.startsWith("@"));
}

const animatedSelectors = (css: string) => selectorsWhere(css, body => /(^|[;\s])animation\s*:/.test(body));
const optedOutSelectors = (css: string) => new Set(selectorsWhere(css, body => /animation\s*:\s*none/.test(body)));

describe("D3 stylesheets", () => {
  for (const [name, css] of [["tasks-premium.css", files.tasks], ["task-detail-inspector.css", files.inspector], ["premium.css D3 section", d3Premium]] as const) {
    const { main, reduced } = split(css);

    it(`${name}: every animated selector is opted out under prefers-reduced-motion`, () => {
      expect(reduced, "has a reduced-motion block").not.toBe("");
      const optedOut = optedOutSelectors(reduced);
      for (const selector of animatedSelectors(main)) expect(optedOut.has(selector), selector).toBe(true);
    });

    it(`${name}: no infinite animation, no transition: all, no green literals`, () => {
      expect(css).not.toMatch(/infinite/);
      expect(css).not.toMatch(/transition:\s*all/);
      expect(css).not.toMatch(/#(?:0f9d8a|167258|1f9d55|16a34a|22c55e|2e7d32|10b981)\b/i);
    });
  }

  it("tasks-premium.css: transitions take their timing from motion tokens", () => {
    for (const match of stripComments(files.tasks).matchAll(/transition:([^;]+);/g)) {
      const value = match[1].trim();
      if (value === "none") continue;
      expect(value, match[0]).toMatch(/var\(--pc-dur-/);
      expect(value.replace(/var\([^)]*\)/g, ""), match[0]).not.toMatch(/\b\d+(\.\d+)?m?s\b/);
    }
  });

  it("tasks-premium.css: the skeleton sweeps once", () => {
    expect(files.tasks).toMatch(/animation:\s*pc-skel-sweep[^;]*\b1 both/);
  });

  it("tasks-premium.css: reuses the shared check keyframes instead of redefining them", () => {
    expect(files.tasks).toContain("pc-check-draw");
    expect(files.tasks).toContain("pc-spring-pop");
    expect(files.tasks).not.toMatch(/@keyframes pc-(check-draw|spring-pop|burst-ring|burst-dots|rise|pop)/);
  });
});
