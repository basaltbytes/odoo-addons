#!/usr/bin/env node
// One-shot bootstrap for a fresh clone:
//   1. install pnpm deps
//   2. install pre-commit hook
//   3. sync Odoo upstream types (auto-detects sibling ../odoo, falls back to GitHub)
//   4. run the doctor
//
// Re-runnable; idempotent.

import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

/**
 * @param {string} label
 * @param {string} cmd
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 */
function step(label, cmd, args, env) {
  console.log(`\n\x1b[36m→ ${label}\x1b[0m`);
  console.log(`  $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {...process.env, ...env},
  });
}

function pnpmInstall() {
  if (existsSync(path.join(repoRoot, "pnpm-lock.yaml"))) {
    step("Install pnpm deps (frozen)", "pnpm", ["install", "--frozen-lockfile"]);
  } else {
    step("Install pnpm deps (no lockfile yet)", "pnpm", ["install"]);
  }
}

function preCommitInstall() {
  step("Install pre-commit hook", "node", [
    path.join("scripts", "install-pre-commit-hook.mjs"),
  ]);
}

function syncOdooTypes() {
  step("Sync Odoo upstream types", "node", [
    path.join("scripts", "sync-odoo-types.mjs"),
  ]);
}

function doctor() {
  step("Doctor", "node", [path.join("scripts", "doctor.mjs")]);
}

try {
  pnpmInstall();
  preCommitInstall();
  syncOdooTypes();
  doctor();
  console.log("\n\x1b[32mSetup complete.\x1b[0m");
} catch (err) {
  console.error(`\n\x1b[31mSetup failed:\x1b[0m ${err.message || err}`);
  process.exit(1);
}
