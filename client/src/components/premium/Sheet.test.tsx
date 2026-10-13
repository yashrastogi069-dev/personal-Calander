import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHEET } from "@/design/motion";
import { sheetKind, sheetMotion } from "./Sheet";

describe("Sheet variants", () => {
  it("maps each variant to a panel kind, with phones always getting the bottom sheet", () => {
    expect(sheetKind("auto", false)).toBe("dialog");
    expect(sheetKind("auto", true)).toBe("sheet");
    expect(sheetKind("dialog", true)).toBe("dialog");
    expect(sheetKind("sheet", false)).toBe("sheet");
    expect(sheetKind("side", false)).toBe("side");
    expect(sheetKind("side", true)).toBe("sheet");
  });

  it("slides the side panel in from the right on the SHEET curve", () => {
    const side = sheetMotion("side", false);
    expect(side.initial).toEqual({ x: "100%" });
    expect(side.animate).toEqual({ x: 0 });
    expect(side.exit).toMatchObject({ x: "100%" });
    expect(side.transition).toBe(SHEET);
  });

  it("makes every kind instant and travel-free under reduced motion", () => {
    for (const kind of ["sheet", "dialog", "side"] as const) {
      const motion = sheetMotion(kind, true);
      expect(motion.transition).toEqual({ duration: 0 });
      expect(motion.initial).not.toHaveProperty("x");
      expect(motion.initial).not.toHaveProperty("y");
      expect(motion.initial).not.toHaveProperty("scale");
    }
  });

  it("docks the side panel right at 480px", () => {
    const css = readFileSync(resolve(__dirname, "premium.css"), "utf8");
    const rule = css.slice(css.indexOf("html .pc-sheet.is-side {"));
    expect(rule).toMatch(/right: 0;[\s\S]*?width: min\(480px, 100vw\);/);
  });
});
