#!/usr/bin/env node
// Reports on the local dev environment so a fresh clone knows what is missing.
// Exits 0 even when optional pieces are missing - only hard failures (Node, pnpm,
// Python out of supported range) cause exit 1.

import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const odooSibling = path.resolve(repoRoot, "..", "odoo");

const NODE_MIN = 22;
const PNPM_MIN = 10;
const PY_MIN = [3, 10];
const PY_MAX = [3, 13];

let hardFail = false;

/**
 * @param {string} cmd
 * @param {string[]} args
 * @returns {string | null}
 */
function tryCmd(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} version
 * @returns {[number, number, number] | null}
 */
function parseSemver(version) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * @param {string} label
 * @param {boolean} ok
 * @param {string} detail
 */
function report(label, ok, detail) {
  const mark = ok ? "✓" : "✗";
  const color = ok ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${mark}\x1b[0m ${label.padEnd(28)} ${detail}`);
}

function checkNode() {
  const v = parseSemver(process.version);
  const ok = Boolean(v) && v[0] >= NODE_MIN;
  if (!ok) hardFail = true;
  report("node", ok, `${process.version} (need >=${NODE_MIN})`);
}

function checkPnpm() {
  const out = tryCmd("pnpm", ["--version"]);
  if (!out) {
    hardFail = true;
    return report(
      "pnpm",
      false,
      "not found (install: corepack enable && corepack prepare pnpm@latest --activate)"
    );
  }
  const v = parseSemver(out);
  const ok = Boolean(v) && v[0] >= PNPM_MIN;
  if (!ok) hardFail = true;
  report("pnpm", ok, `${out} (need >=${PNPM_MIN})`);
}

function checkPython() {
  const out = tryCmd("python", ["--version"]) || tryCmd("python3", ["--version"]);
  if (!out) {
    hardFail = true;
    return report("python", false, "not found");
  }
  const v = parseSemver(out);
  if (!v) {
    hardFail = true;
    return report("python", false, `unparsable: ${out}`);
  }
  const ge = v[0] > PY_MIN[0] || (v[0] === PY_MIN[0] && v[1] >= PY_MIN[1]);
  const le = v[0] < PY_MAX[0] || (v[0] === PY_MAX[0] && v[1] <= PY_MAX[1]);
  const ok = ge && le;
  if (!ok) hardFail = true;
  report("python", ok, `${out} (need ${PY_MIN.join(".")}-${PY_MAX.join(".")})`);
}

function checkPreCommit() {
  const out =
    tryCmd("pre-commit", ["--version"]) ||
    tryCmd("python", ["-m", "pre_commit", "--version"]);
  report(
    "pre-commit",
    Boolean(out),
    out || "not found (install: python -m pip install pre-commit)"
  );
}

function checkRuff() {
  const out =
    tryCmd("python", ["-m", "ruff", "--version"]) || tryCmd("ruff", ["--version"]);
  report(
    "ruff",
    Boolean(out),
    out || "not found (install: python -m pip install ruff)"
  );
}

function checkOdooSibling() {
  const ok = existsSync(path.join(odooSibling, "odoo-bin"));
  const detail = ok
    ? `${odooSibling} (types sync uses local checkout; tests workflow can install)`
    : `not found at ${odooSibling} (optional; type sync falls back to GitHub remote)`;
  report("odoo sibling checkout", ok, detail);
}

function checkPnpmInstalled() {
  const ok = existsSync(path.join(repoRoot, "node_modules"));
  report("node_modules", ok, ok ? "installed" : "run: pnpm install");
}

function checkOdooTypes() {
  const dir = path.join(repoRoot, "types", "odoo-upstream");
  const ok = existsSync(path.join(dir, "manifest.json"));
  report("odoo-upstream types", ok, ok ? "synced" : "run: pnpm sync:odoo-types");
}

console.log("Environment check\n");
checkNode();
checkPnpm();
checkPython();
checkPreCommit();
checkRuff();
checkOdooSibling();
checkPnpmInstalled();
checkOdooTypes();

console.log("");
if (hardFail) {
  console.log("\x1b[31mOne or more required tools are missing or out of range.\x1b[0m");
  process.exit(1);
} else {
  console.log("\x1b[32mAll required tools present.\x1b[0m");
}
