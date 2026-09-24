#!/usr/bin/env node
// Configure the local git merge driver that .gitattributes points *.po / *.pot at,
// so rebases and merges auto-resolve gettext translation conflicts (scripts/git-merge-po.sh).
// Idempotent and tolerant: it must never fail `pnpm install`.
import {execFileSync} from "node:child_process";

function setConfig(key, value) {
  execFileSync("git", ["config", key, value], {stdio: ["ignore", "ignore", "ignore"]});
}

try {
  setConfig("merge.odoo-po.name", "Gettext PO/POT union merge driver");
  setConfig("merge.odoo-po.driver", "sh scripts/git-merge-po.sh %O %A %B %P");
  console.log("[setup-git] configured the odoo-po merge driver for *.po / *.pot");
} catch (error) {
  // Not a git checkout, or git is unavailable (e.g. a packaging step). The driver is an
  // optional convenience; fall back to git's default line-based merge.
  console.warn(`[setup-git] skipped merge-driver setup: ${error.message}`);
}
