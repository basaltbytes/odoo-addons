#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.PYTHON || "python";
const preCommitHome = path.join(repoRoot, ".pre-commit-cache");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PRE_COMMIT_HOME: process.env.PRE_COMMIT_HOME || preCommitHome,
    },
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout?.trim() ?? "";
}

run(python, [
  "-m",
  "pre_commit",
  "install",
  "--hook-type",
  "pre-commit",
  "--overwrite",
]);

const hookPathOutput = run("git", ["rev-parse", "--git-path", "hooks/pre-commit"], {
  capture: true,
});
const hookPath = path.resolve(repoRoot, hookPathOutput);
const marker = "# odoo-addons: repo-local pre-commit cache";
const injection = `${marker}
REPO_ROOT="$(git rev-parse --show-toplevel)"
export PRE_COMMIT_HOME="\${PRE_COMMIT_HOME:-\${REPO_ROOT}/.pre-commit-cache}"
`;

const hook = readFileSync(hookPath, "utf8");

if (!hook.includes(marker)) {
  const lines = hook.split("\n");
  const insertAt = lines[0]?.startsWith("#!") ? 1 : 0;
  lines.splice(insertAt, 0, injection.trimEnd());
  writeFileSync(hookPath, lines.join("\n"));
}

console.log(`Installed pre-commit hook with PRE_COMMIT_HOME=${preCommitHome}`);
