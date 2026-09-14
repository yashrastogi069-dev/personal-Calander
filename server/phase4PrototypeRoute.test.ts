import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
    const imports = implementation.match(/^import .*$/gm)?.join("\n") ?? "";

    for (const forbiddenImport of ["trpc", "supabase", "indexedDB", "offlineStore", "serviceWorker", "fetch(", "axios"]) {
      expect(imports.toLowerCase()).not.toContain(forbiddenImport.toLowerCase());
    }
    expect(implementation).toContain("Prototype data — nothing here is saved");
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
});
