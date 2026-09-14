import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrototypeShell, {
  type PrototypeVariant,
  type PrototypeViewport,
} from "../client/src/features/phase4-prototypes/PrototypeShell";
import {
  createPrototypeState,
  reducePrototypeState,
  type PrototypeState,
} from "../shared/phase4Prototype";

const root = path.resolve(import.meta.dirname, "..");
const appPath = path.join(root, "client/src/App.tsx");
const prototypeFiles = [
  "client/src/pages/Phase4Prototypes.tsx",
  "client/src/features/phase4-prototypes/PrototypeShell.tsx",
  "client/src/features/phase4-prototypes/PrototypeToday.tsx",
  "client/src/features/phase4-prototypes/PrototypeTasks.tsx",
  "client/src/features/phase4-prototypes/PrototypeRoadmap.tsx",
  "client/src/features/phase4-prototypes/PrototypeSettings.tsx",
  "client/src/features/phase4-prototypes/phase4-prototypes.css",
] as const;

function source(relativePath: string) {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function renderPrototype(
  state: PrototypeState,
  variant: PrototypeVariant = "a",
  viewport: PrototypeViewport = "phone",
) {
  return renderToStaticMarkup(createElement(PrototypeShell, {
    state,
    dispatch: () => undefined,
    variant,
    density: "comfortable",
    viewport,
    recoveryChoice: null,
    selectedLane: "todo",
    onVariantChange: () => undefined,
    onDensityChange: () => undefined,
    onViewportChange: () => undefined,
    onRecoveryChoice: () => undefined,
    onSelectedLaneChange: () => undefined,
  }));
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex: string) {
  const channels = hexToRgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function variantTokens(css: string, variant: "a" | "b") {
  const block = css.match(new RegExp(`\\[data-prototype-variant="${variant}"\\] \\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--([\w-]+):(#(?:[0-9a-f]{3}){1,2})/gi)].map(match => [match[1], match[2]]));
}

describe("Phase 4 prototype route contract", () => {
  it("lazy-loads the prototype inside the existing authenticated planner", () => {
    const appSource = readFileSync(appPath, "utf8");

    expect(appSource).toContain('path={"/phase4-prototypes"}');
    expect(appSource).toContain("const Phase4Prototypes = lazy(");
    expect(appSource).toContain('import("./pages/Phase4Prototypes")');
    expect(appSource.match(/<AuthenticatedPlanner>/g)).toHaveLength(1);
  });

  it("ships every isolated prototype surface", () => {
    expect(prototypeFiles.filter(file => !existsSync(path.join(root, file)))).toEqual([]);
  });

  it("keeps the prototype free of planner persistence and network clients", () => {
    const implementation = prototypeFiles.map(source).join("\n");

    for (const forbiddenPattern of [
      /@trpc/i,
      /@supabase/i,
      /\btrpc\s*\./i,
      /\bsupabase\s*\./i,
      /\bindexedDB\s*\./i,
      /\bofflineStore\b/i,
      /\bserviceWorker\s*\./i,
      /\bfetch\s*\(/i,
      /\baxios\b/i,
    ]) {
      expect(implementation).not.toMatch(forbiddenPattern);
    }
    expect(implementation).toContain("Prototype data — nothing here is saved");
  });

  it("renders phone Capture open and closed for every visual variant", () => {
    const initial = createPrototypeState();
    const opened = reducePrototypeState(initial, { type: "open-sheet", sheet: "capture" });
    const closed = reducePrototypeState(opened, { type: "close-sheet" });

    for (const variant of ["a", "b", "c"] as const) {
      expect(renderPrototype(initial, variant)).toContain('data-testid="phone-open-capture"');
      expect(renderPrototype(opened, variant)).toContain('role="dialog"');
      expect(renderPrototype(opened, variant)).toContain('data-testid="close-capture"');
      expect(renderPrototype(closed, variant)).not.toContain('data-testid="close-capture"');
    }
  });

  it("renders detail for the selected task instead of a hard-coded fixture row", () => {
    const selectedTaskState = reducePrototypeState(createPrototypeState(), {
      type: "open-task-detail",
      taskId: "reply-samira",
    });
    const html = renderPrototype(selectedTaskState, "a", "desktop");

    expect(html).toContain('data-selected-task-id="reply-samira"');
    expect(html).toContain("Reply to Samira about the contractor estimate");
    expect(html).toContain("Waiting");
    expect(html).not.toContain("Open Â· To do");
    expect(html).not.toContain("Home move Â· Settle into the new home Â· Admin");
    expect(html).not.toContain("Document review Â· v7");
  });

  it("renders a completed selected task as completed rather than open", () => {
    const completed = reducePrototypeState(createPrototypeState(), {
      type: "complete-task",
      taskId: "buy-groceries",
    });
    const selected = reducePrototypeState(completed, {
      type: "open-task-detail",
      taskId: "buy-groceries",
    });
    const html = renderPrototype(selected, "b", "desktop");

    expect(html).toContain('data-selected-task-id="buy-groceries"');
    expect(html).toContain("Completed");
    expect(html).not.toContain("<dd>Open</dd>");
  });

  it("renders a way back to desktop inside the phone More directory", () => {
    const moreOpen = reducePrototypeState(createPrototypeState(), { type: "open-sheet", sheet: "settings" });
    const html = renderPrototype(moreOpen, "c", "phone");
    const desktopHtml = renderPrototype(createPrototypeState(), "c", "desktop");

    expect(html).toContain('data-testid="more-viewport-desktop"');
    expect(desktopHtml).toContain('data-testid="viewport-phone"');
  });

  it("exposes stable hooks for the shared functional interaction set", () => {
    const implementation = prototypeFiles.map(source).join("\n");
    const requiredHooks = [
      "prototype-shell",
      "prototype-notice",
      "variant-a",
      "variant-b",
      "variant-c",
      "density-comfortable",
      "density-compact",
      "view-today",
      "view-tasks",
      "view-roadmap",
      "view-settings",
      "task-toggle-read-lease",
      "open-capture",
      "close-capture",
      "open-task-detail",
      "close-task-detail",
      "open-recovery",
      "resume-recovery",
      "recovery-done",
      "recovery-reschedule",
      "recovery-reduce",
      "recovery-pause",
      "recovery-abandon",
      "close-recovery",
      "preview-roadmap-move",
      "cancel-roadmap-move",
    ];

    for (const hook of requiredHooks) expect(implementation).toContain(hook);
    expect(implementation).toContain('"complete-task"');
    expect(implementation).toContain('"reopen-task"');
    expect(implementation).toContain('type: "preview-roadmap-move"');
    expect(implementation).toContain('type: "cancel-roadmap-preview"');
  });

  it("represents required navigation, states, and settings without operational sign-out", () => {
    const implementation = prototypeFiles.map(source).join("\n");

    for (const destination of ["Home", "Tasks", "Plan", "Projects & Goals", "Habits", "Review"]) {
      expect(implementation).toContain(destination);
    }
    for (const group of [
      "Account",
      "Appearance",
      "Planning",
      "Sync & Offline",
      "Categories & Recycle Bin",
      "App & Device",
      "Connections",
    ]) {
      expect(implementation).toContain(group);
    }
    for (const stateHook of [
      "state-loading",
      "state-empty",
      "state-error",
      "state-conflict",
      "state-disabled",
      "state-saved-locally",
      "state-unsupported-offline",
      "state-long-content",
      "state-archived",
      "state-recurring-boundary",
    ]) {
      expect(implementation).toContain(`data-testid="${stateHook}"`);
    }
    expect(implementation).toContain("Sign out on this device");
    expect(implementation).toContain("Preview only — sign out is not connected");
  });

  it("defines distinct accessible visual systems and the exact R20 task lanes", () => {
    const cssSource = source("client/src/features/phase4-prototypes/phase4-prototypes.css");

    expect(cssSource).toContain('[data-prototype-variant="a"]');
    expect(cssSource).toContain("--prototype-todo:#2a405d");
    expect(cssSource).toContain("--prototype-todo-end:#15283f");
    expect(cssSource).toContain("--prototype-doing:#155b59");
    expect(cssSource).toContain("--prototype-doing-end:#0b393b");
    expect(cssSource).toContain("--prototype-done:#1d4b3d");
    expect(cssSource).toContain("--prototype-done-end:#102f27");
    expect(cssSource).toContain('[data-prototype-variant="b"]');
    expect(cssSource).toContain('[data-prototype-variant="c"]');
    expect(cssSource).toContain("min-height:44px");
    expect(cssSource).toContain(":focus-visible");
    expect(cssSource).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it.each(["a", "b"] as const)("keeps variant %s muted and warning text at WCAG AA contrast", variant => {
    const cssSource = source("client/src/features/phase4-prototypes/phase4-prototypes.css");
    const tokens = variantTokens(cssSource, variant);

    for (const background of [tokens["prototype-bg"], tokens["prototype-surface"], tokens["prototype-elevated"]]) {
      expect(contrastRatio(tokens["prototype-muted"], background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(tokens["prototype-warning"], tokens["prototype-warning-soft"])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps functional and secondary text at least 14px", () => {
    const cssSource = source("client/src/features/phase4-prototypes/phase4-prototypes.css");

    expect(cssSource.match(/font-size:\s*(?:11|12|13)px/g)).toBeNull();
  });
});
