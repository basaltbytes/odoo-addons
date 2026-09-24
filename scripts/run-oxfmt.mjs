#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {existsSync, statSync} from "node:fs";
import process from "node:process";

const files = process.argv.slice(2).filter((file) => {
  if (!existsSync(file)) {
    return false;
  }
  return statSync(file).isFile();
});

if (files.length === 0) {
  process.exit(0);
}

// `--no-error-on-unmatched-pattern` keeps oxfmt from exiting non-zero when every
// passed file is one it does not format (e.g. an XML-only commit — oxfmt has no XML
// parser) or is covered by an ignore rule. Without it, pre-commit fails on such
// commits even though there is nothing for oxfmt to do. See oxfmt docs (Prettier-
// compatible `--no-error-on-unmatched-pattern`).
const result = spawnSync(
  "pnpm",
  ["exec", "oxfmt", "--no-error-on-unmatched-pattern", ...files],
  {stdio: "inherit"}
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
