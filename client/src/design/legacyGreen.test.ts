// Ratchet for the quarantined legacy green palette (D0). Counts may only go down.
// When a rebuilt screen removes green rules, lower its baseline in the same commit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_SRC = resolve(__dirname, "..");

// Green-hued semantic tokens (completion, on-track, health) are intentional and live here.
// The gallery shows the validated palette itself.
const ALLOWLIST = new Set(["design/tokens-v2.css", "features/shell/phase4-tokens.css", "pages/PremiumGallery.tsx"]);

const BASELINE: Record<string, number> = {
  "features/calendar/CalendarExecutionWorkspace.tsx": 2,
  "features/calendar/calendar-execution.css": 246,
  "features/habits/HabitDisciplineWorkspace.tsx": 1,
  "features/phase4-prototypes/phase4-prototypes.css": 22,
  "features/review/review-checklist.css": 14,
  "features/tasks/task-workspace.css": 4,
  "index.css": 1110,
  "pages/Home.tsx": 1,
  "pages/calendar-matrix.css": 39,
};

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isGreenHex(hex: string): boolean {
  const [r, g, b] = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return false;
  const lightness = (max + min) / 2;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = ((hue * 60 + 360) % 360) / 360;
  return hue > 0.22 && hue < 0.5 && saturation > 0.12;
}

function countGreens(source: string): number {
  const hexes = [...source.matchAll(/#([0-9a-fA-F]{6})\b/g)].filter(match => isGreenHex(match[1])).length;
  const tailwind = [...source.matchAll(/\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:green|emerald|lime)-\d{2,3}\b/g)].length;
  return hexes + tailwind;
}

describe("legacy green quarantine", () => {
  const files = walk(CLIENT_SRC)
    .filter(path => /\.(css|tsx)$/.test(path) && !/\.test\.tsx$/.test(path))
    .map(path => relative(CLIENT_SRC, path).replace(/\\/g, "/"))
    .filter(path => !ALLOWLIST.has(path));

  it("does not add green literals beyond each file's baseline", () => {
    const over = files
      .map(path => ({ path, count: countGreens(readFileSync(join(CLIENT_SRC, path), "utf8")), limit: BASELINE[path] ?? 0 }))
      .filter(entry => entry.count > entry.limit);
    expect(over).toEqual([]);
  });
});
