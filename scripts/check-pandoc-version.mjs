#!/usr/bin/env node

import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const expectedVersion = packageJson.config?.pandocVersion;

if (!expectedVersion) {
  console.error("Missing package.json config.pandocVersion.");
  process.exit(1);
}

let versionOutput = "";
try {
  versionOutput = execFileSync("pandoc", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  console.error(
    `pandoc ${expectedVersion} is required for deterministic README generation, but pandoc was not found on PATH.`
  );
  process.exit(1);
}

const actualVersion = /^pandoc\s+(\S+)/u.exec(versionOutput)?.[1];

if (actualVersion !== expectedVersion) {
  console.error(
    `pandoc ${expectedVersion} is required for deterministic README generation; found ${actualVersion ?? "unknown"}.`
  );
  console.error(
    "Activate the pinned version before running pnpm run gen:readme, or update package.json and CI in the same change."
  );
  process.exit(1);
}

console.log(`pandoc ${actualVersion}`);
