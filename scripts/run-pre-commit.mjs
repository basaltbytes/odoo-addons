#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.PYTHON || "python";
const preCommitHome = path.join(repoRoot, ".pre-commit-cache");
const args = process.argv.slice(2);

const result = spawnSync(python, ["-m", "pre_commit", ...args], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PRE_COMMIT_HOME: process.env.PRE_COMMIT_HOME || preCommitHome,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
