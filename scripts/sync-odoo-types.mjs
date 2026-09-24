#!/usr/bin/env node

import {execFileSync} from "node:child_process";
import {access, mkdir, readdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const DEFAULT_REF = "19.0";
const GITHUB_OWNER = "odoo";
const GITHUB_REPO = "odoo";
const UPSTREAM_TYPES_PREFIX = "addons/web/static/src/@types/";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const localOdooRoot = path.resolve(repoRoot, "..", "odoo");
const localOdooTypesDir = path.join(
  localOdooRoot,
  "addons",
  "web",
  "static",
  "src",
  "@types"
);
const outputDir = path.join(repoRoot, "types", "odoo-upstream");
const manifestPath = path.join(outputDir, "manifest.json");

/**
 * @typedef {{
 *   source: "local" | "remote",
 *   repo: string,
 *   upstreamRef: string,
 *   resolvedSha: string | null,
 *   sourcePath?: string,
 *   generatedAt: string,
 *   files: string[],
 * }} SyncManifest
 */

/**
 * @returns {{ source: "auto" | "local" | "remote", refresh: boolean, force: boolean, ref: string }}
 */
function parseArgs() {
  /** @type {{ source: "auto" | "local" | "remote", refresh: boolean, force: boolean, ref: string }} */
  const options = {
    source: "auto",
    refresh: false,
    force: false,
    ref: DEFAULT_REF,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === "--refresh") {
      options.refresh = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--source=")) {
      const value = arg.slice("--source=".length);
      if (!["auto", "local", "remote"].includes(value)) {
        throw new Error(`Unsupported --source value: ${value}`);
      }
      options.source = /** @type {"auto" | "local" | "remote"} */ (value);
    } else if (arg.startsWith("--ref=")) {
      options.ref = arg.slice("--ref=".length) || DEFAULT_REF;
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

/**
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFilesRecursive(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listTypeFiles(dir) {
  if (!(await exists(dir))) {
    return [];
  }
  const files = await listFilesRecursive(dir);
  return files
    .filter((filePath) => filePath.endsWith(".d.ts"))
    .map((filePath) => path.relative(dir, filePath).split(path.sep).join("/"))
    .sort();
}

/**
 * @returns {Promise<SyncManifest | null>}
 */
async function readManifest() {
  if (!(await exists(manifestPath))) {
    return null;
  }
  return /** @type {SyncManifest} */ (JSON.parse(await readFile(manifestPath, "utf8")));
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<void>}
 */
async function writeTextFile(filePath, content) {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, content);
}

/**
 * @param {SyncManifest} manifest
 * @returns {Promise<void>}
 */
async function writeManifest(manifest) {
  await writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * @returns {Promise<boolean>}
 */
async function snapshotExists() {
  const [manifest, files] = await Promise.all([
    readManifest(),
    listTypeFiles(outputDir),
  ]);
  return Boolean(manifest && files.length > 0);
}

/**
 * @returns {string | null}
 */
function getLocalGitSha() {
  try {
    return execFileSync("git", ["-C", localOdooRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @returns {string | null}
 */
function getLocalGitBranch() {
  try {
    return execFileSync(
      "git",
      ["-C", localOdooRoot, "rev-parse", "--abbrev-ref", "HEAD"],
      {encoding: "utf8"}
    ).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} label
 * @param {string[]} relativeFiles
 * @param {(relativePath: string) => Promise<string>} readContent
 * @returns {Promise<void>}
 */
async function writeSnapshot(label, relativeFiles, readContent) {
  await rm(outputDir, {recursive: true, force: true});
  await mkdir(outputDir, {recursive: true});

  for (const relativePath of relativeFiles) {
    const content = await readContent(relativePath);
    await writeTextFile(path.join(outputDir, relativePath), content);
  }

  console.log(`Wrote ${relativeFiles.length} Odoo type file(s) from ${label}.`);
}

/**
 * @returns {Promise<void>}
 */
async function syncFromLocal() {
  const relativeFiles = await listTypeFiles(localOdooTypesDir);
  if (!relativeFiles.length) {
    throw new Error(`No .d.ts files found under ${localOdooTypesDir}`);
  }

  await writeSnapshot(
    `local checkout at ${localOdooTypesDir}`,
    relativeFiles,
    async (relativePath) => readFile(path.join(localOdooTypesDir, relativePath), "utf8")
  );

  await writeManifest({
    source: "local",
    repo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    upstreamRef: getLocalGitBranch() || DEFAULT_REF,
    resolvedSha: getLocalGitSha(),
    sourcePath: path.relative(repoRoot, localOdooTypesDir).split(path.sep).join("/"),
    generatedAt: new Date().toISOString(),
    files: relativeFiles,
  });
}

/**
 * @returns {Record<string, string>}
 */
function githubHeaders() {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "basaltbytes-odoo-addons-type-sync",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * @template T
 * @param {string} url
 * @returns {Promise<T>}
 */
async function fetchJson(url) {
  const response = await fetch(url, {headers: githubHeaders()});
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }
  return /** @type {Promise<T>} */ (response.json());
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const response = await fetch(url, {headers: githubHeaders()});
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

/**
 * @param {string} ref
 * @returns {Promise<string>}
 */
async function resolveRemoteSha(ref) {
  if (/^[0-9a-f]{40}$/i.test(ref)) {
    return ref.toLowerCase();
  }
  const commit = await fetchJson(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${encodeURIComponent(ref)}`
  );
  return /** @type {{ sha: string }} */ (commit).sha;
}

/**
 * @param {string} sha
 * @returns {Promise<string[]>}
 */
async function fetchRemoteTypeFileList(sha) {
  const tree = await fetchJson(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${sha}?recursive=1`
  );
  const entries =
    /** @type {{ tree?: Array<{ path: string, type: string }> }} */ (tree).tree || [];
  return entries
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter(
      (entryPath) =>
        entryPath.startsWith(UPSTREAM_TYPES_PREFIX) && entryPath.endsWith(".d.ts")
    )
    .map((entryPath) => entryPath.slice(UPSTREAM_TYPES_PREFIX.length))
    .sort();
}

/**
 * @param {string} relativePath
 * @param {string} sha
 * @returns {string}
 */
function rawGithubUrl(relativePath, sha) {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${sha}/${UPSTREAM_TYPES_PREFIX}${relativePath}`;
}

/**
 * @param {{ refresh: boolean, ref: string }} options
 * @returns {Promise<void>}
 */
async function syncFromRemote(options) {
  const manifest = await readManifest();
  const upstreamRef = manifest?.upstreamRef || options.ref || DEFAULT_REF;
  const resolvedSha = options.refresh
    ? await resolveRemoteSha(options.ref || upstreamRef)
    : await resolveRemoteSha(manifest?.resolvedSha || options.ref || upstreamRef);
  const relativeFiles = options.refresh
    ? await fetchRemoteTypeFileList(resolvedSha)
    : manifest?.files?.length
      ? manifest.files
      : await fetchRemoteTypeFileList(resolvedSha);

  await writeSnapshot(
    `remote ${GITHUB_OWNER}/${GITHUB_REPO}@${resolvedSha}`,
    relativeFiles,
    async (relativePath) => fetchText(rawGithubUrl(relativePath, resolvedSha))
  );

  await writeManifest({
    source: "remote",
    repo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    upstreamRef,
    resolvedSha,
    generatedAt: new Date().toISOString(),
    files: relativeFiles,
  });
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const options = parseArgs();
  const localSourceAvailable = await exists(localOdooTypesDir);

  if (options.source === "local" && !localSourceAvailable) {
    throw new Error(`Local Odoo types not found at ${localOdooTypesDir}`);
  }

  if (
    options.source === "auto" &&
    !options.refresh &&
    !options.force &&
    !localSourceAvailable &&
    (await snapshotExists())
  ) {
    console.log("Vendored Odoo type snapshot already present; nothing to do.");
    return;
  }

  if (
    options.source === "local" ||
    (options.source === "auto" && localSourceAvailable)
  ) {
    await syncFromLocal();
    return;
  }

  await syncFromRemote(options);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
