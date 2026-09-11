import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(repositoryRoot, "client", "public");

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

type ManifestShortcut = {
  name: string;
  url: string;
};

type WebManifest = {
  id?: string;
  scope?: string;
  start_url?: string;
  display?: string;
  display_override?: string[];
  orientation?: string;
  lang?: string;
  dir?: string;
  categories?: string[];
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
};

async function readManifest() {
  return JSON.parse(
    await readFile(resolve(publicDirectory, "manifest.webmanifest"), "utf8"),
  ) as WebManifest;
}

async function pngDimensions(relativePath: string) {
  const file = await readFile(resolve(publicDirectory, relativePath));
  expect(file.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(file.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe("PWA install contract", () => {
  it("uses a stable standalone identity with useful shortcut routes", async () => {
    const manifest = await readManifest();

    expect(manifest).toMatchObject({
      id: "/",
      scope: "/",
      start_url: "/?source=pwa",
      display: "standalone",
      orientation: "any",
      lang: "en",
      dir: "ltr",
    });
    expect(manifest.display_override).toContain("standalone");
    expect(manifest.categories).toEqual(
      expect.arrayContaining(["productivity", "utilities"]),
    );
    expect(manifest.shortcuts?.map(shortcut => shortcut.url)).toEqual([
      "/?surface=today&source=pwa-shortcut",
      "/?compose=task&source=pwa-shortcut",
    ]);
  });

  it.each([
    ["icons/apple-touch-icon-180.png", 180],
    ["icons/icon-192.png", 192],
    ["icons/icon-512.png", 512],
    ["icons/icon-maskable-192.png", 192],
    ["icons/icon-maskable-512.png", 512],
  ])("ships %s at %ipx", async (path, size) => {
    await expect(pngDimensions(path)).resolves.toEqual({
      width: size,
      height: size,
    });
  });

  it("declares standard and maskable raster icons", async () => {
    const manifest = await readManifest();
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" }),
        expect.objectContaining({ src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }),
      ]),
    );
  });

  it("provides static iPhone standalone metadata", async () => {
    const html = await readFile(resolve(repositoryRoot, "client", "index.html"), "utf8");
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Personal Calendar"');
    expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png"');
  });
});
