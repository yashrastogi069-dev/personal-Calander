import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectPrecacheFiles,
  createPwaBuild,
  injectPwaBuild,
} from "./build-pwa.mjs";

const temporaryDirectories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "personal-calendar-pwa-"));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, "assets"), { recursive: true });
  await mkdir(join(directory, "icons"), { recursive: true });
  await writeFile(join(directory, "index.html"), "<main>planner</main>");
  await writeFile(join(directory, "offline.html"), "<main>offline</main>");
  await writeFile(join(directory, "manifest.webmanifest"), "{}");
  await writeFile(join(directory, "icon.svg"), "<svg />");
  await writeFile(join(directory, "icons", "icon-192.png"), "png-192");
  await writeFile(join(directory, "assets", "index-ABC123.js"), "app-js");
  await writeFile(join(directory, "assets", "index-ABC123.css"), "app-css");
  await writeFile(join(directory, "assets", "index-ABC123.js.map"), "source-map");
  await writeFile(join(directory, "secret.txt"), "never-cache-me");
  await writeFile(join(directory, "sw.js"), "old-worker");
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("production PWA build generation", () => {
  it("selects only the public application shell in stable URL order", async () => {
    const directory = await fixture();

    await expect(collectPrecacheFiles(directory)).resolves.toEqual([
      "/",
      "/assets/index-ABC123.css",
      "/assets/index-ABC123.js",
      "/icon.svg",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
      "/offline.html",
    ]);
  });

  it("derives the same release from identical content and a new release from changed content", async () => {
    const directory = await fixture();
    const urls = await collectPrecacheFiles(directory);
    const first = await createPwaBuild(directory, urls);
    const second = await createPwaBuild(directory, [...urls].reverse());

    expect(first).toEqual(second);
    expect(first.release).toMatch(/^[a-f0-9]{16}$/);
    await writeFile(join(directory, "assets", "index-ABC123.js"), "changed-app-js");
    await expect(createPwaBuild(directory, urls)).resolves.not.toEqual(first);
  });

  it("injects exactly one serialized build record", async () => {
    const directory = await fixture();
    const build = await createPwaBuild(directory, await collectPrecacheFiles(directory));
    const marker = "/*__PERSONAL_CALENDAR_PWA_BUILD__*/";
    const generated = injectPwaBuild(`before\n${marker}\nafter`, build);

    expect(generated).toContain(
      `self.__PERSONAL_CALENDAR_PWA_BUILD__ = ${JSON.stringify(build)};`,
    );
    expect(generated).not.toContain(marker);
    expect(() => injectPwaBuild("no marker", build)).toThrow("exactly one build marker");
    expect(() => injectPwaBuild(`${marker}\n${marker}`, build)).toThrow("exactly one build marker");
  });

  it("never selects API-like or user-data files even when nested", async () => {
    const directory = await fixture();
    await mkdir(join(directory, "api", "planner"), { recursive: true });
    await writeFile(join(directory, "api", "planner", "snapshot.json"), "private");
    await mkdir(join(directory, "uploads"), { recursive: true });
    await writeFile(join(directory, "uploads", "attachment.png"), "private-file");

    const urls = await collectPrecacheFiles(directory);

    expect(urls.every(url => !url.startsWith("/api/") && !url.startsWith("/uploads/"))).toBe(true);
  });

  it("bounds runtime static caching by both entry count and age", async () => {
    const worker = await readFile(join(process.cwd(), "client", "public", "sw.js"), "utf8");
    expect(worker).toMatch(/runtimeLimit\s*=\s*40/);
    expect(worker).toMatch(/runtimeMaxAgeMs\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(worker).toContain("x-personal-calendar-cached-at");
    expect(worker).toContain("Date.now() - cachedAt > runtimeMaxAgeMs");
  });
});
