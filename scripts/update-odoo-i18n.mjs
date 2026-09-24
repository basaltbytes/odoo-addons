#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const moduleName = process.argv[2];
const language = process.argv[3] || "fr_FR";

if (!moduleName) {
  console.error("Usage: node scripts/update-odoo-i18n.mjs <module> [language]");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const addonDir = path.join(repoRoot, "addons", moduleName);

if (!existsSync(addonDir)) {
  console.error(`Unknown addon: ${moduleName}`);
  process.exit(2);
}

function getDatabaseName() {
  const result = spawnSync("pnpm", ["exec", "oad", "info", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return JSON.parse(result.stdout).databaseName;
}

const databaseName = getDatabaseName();
const containerScript = `
set -eu
config_file="$(mktemp)"
trap 'rm -f "$config_file"' EXIT
{
  printf '%s\\n' '[options]'
  printf '%s\\n' 'addons_path = /usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons/basaltbytes'
  printf '%s\\n' 'db_host = db'
  printf '%s\\n' 'db_port = 5432'
  printf '%s\\n' 'db_user = odoo'
  printf '%s\\n' 'db_password = odoo'
} > "$config_file"
odoo i18n export -c "$config_file" -d "$1" "$2" -l pot "$3"
`;

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "oad",
    "compose",
    "--",
    "run",
    "--rm",
    "-T",
    "odoo",
    "sh",
    "-lc",
    containerScript,
    "odoo-addons-i18n",
    databaseName,
    moduleName,
    language,
  ],
  {cwd: repoRoot, stdio: "inherit"}
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
