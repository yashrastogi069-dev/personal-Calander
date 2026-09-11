import { createHash } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BUILD_MARKER = "/*__PERSONAL_CALENDAR_PWA_BUILD__*/";
const ROOT_SHELL_FILES = new Set(["icon.svg", "index.html", "manifest.webmanifest", "offline.html"]);

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function isShellFile(relativePath) {
  if (ROOT_SHELL_FILES.has(relativePath)) return true;
  if (relativePath.startsWith("assets/")) return /\.(?:css|js)$/.test(relativePath);
  if (relativePath.startsWith("icons/")) return /\.png$/.test(relativePath);
  return false;
}

function filePathForUrl(outputDirectory, url) {
  return path.join(outputDirectory, url === "/" ? "index.html" : url.slice(1).replaceAll("/", path.sep));
}

export async function collectPrecacheFiles(outputDirectory) {
  const files = (await walk(outputDirectory)).filter(isShellFile);
  return files.map(file => file === "index.html" ? "/" : `/${file}`).sort();
}

export async function createPwaBuild(outputDirectory, urls) {
  const precache = [...new Set(urls)].sort();
  const hash = createHash("sha256");
  for (const url of precache) {
    hash.update(url);
    hash.update("\0");
    hash.update(await readFile(filePathForUrl(outputDirectory, url)));
    hash.update("\0");
  }
  return { release: hash.digest("hex").slice(0, 16), precache };
}

export function injectPwaBuild(template, build) {
  const markerCount = template.split(BUILD_MARKER).length - 1;
  if (markerCount !== 1) throw new Error("Service worker must contain exactly one build marker.");
  return template.replace(BUILD_MARKER, `self.__PERSONAL_CALENDAR_PWA_BUILD__ = ${JSON.stringify(build)};`);
}

export async function generateServiceWorker({ repositoryRoot, outputDirectory }) {
  const template = await readFile(path.join(repositoryRoot, "client", "public", "sw.js"), "utf8");
  const build = await createPwaBuild(outputDirectory, await collectPrecacheFiles(outputDirectory));
  const outputPath = path.join(outputDirectory, "sw.js");
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, injectPwaBuild(template, build));
  await rename(temporaryPath, outputPath);
  return build;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outputDirectory = path.join(repositoryRoot, "dist", "public");
  const build = await generateServiceWorker({ repositoryRoot, outputDirectory });
  console.log(`[PWA] generated release ${build.release} with ${build.precache.length} shell files`);
}
