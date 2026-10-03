import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const theme = readFileSync(new URL("./phase4-tokens.css", import.meta.url), "utf8");
function tokens(selector: string) {
  const block = theme.slice(theme.indexOf(selector)).split("}")[0];
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/g)].map(match => [match[1], match[2]]));
}
function luminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + .05) / (values[1] + .05);
}

describe("blue world theme", () => {
  it.each(["html:root", "html:root.dark"])("keeps essential text and labeled semantic colors readable in %s", selector => {
    const values = tokens(selector);
    for (const surface of ["--surface", "--surface-elevated", "--surface-subtle", "--selection"]) {
      for (const text of ["--ink", "--ink-muted", "--ink-subtle"]) expect(contrast(values[text], values[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const [text, surface] of [["--context-violet", "--context-violet-soft"], ["--context-coral", "--context-coral-soft"], ["--warning", "--warning-soft"], ["--completion", "--completion-soft"]]) {
      expect(contrast(values[text], values[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(values["--accent"], selector === "html:root" ? "#ffffff" : "#0c1317")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(values["--focus-ring"], values["--surface-elevated"])).toBeGreaterThanOrEqual(3);
  });

  it("imports the approved theme and preserves the existing dark Task lane identities", () => {
    const index = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
    expect(index).toContain('@import "./features/shell/blue-theme.css"');
    for (const color of ["#2a405d", "#155b59", "#1d4b3d"]) expect(index).toContain(color);
    expect(theme).not.toContain(".task-lane");
  });

  it("keeps the light working canvas white and reserves blue for selection", () => {
    const light = tokens("html:root");
    expect(light["--surface"]).toBe("#ffffff");
    expect(light["--surface-elevated"]).toBe("#ffffff");
    expect(light["--surface-subtle"]).toBe("#f5f7fb");
    expect(light["--selection"]).toBe("#e4efff");
  });
});
