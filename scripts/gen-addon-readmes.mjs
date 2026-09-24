import {execFileSync} from "node:child_process";
import {existsSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const orgName = "basaltbytes";
const repoName = "odoo-addons";
const branch = "main";

// Vendored third-party addons keep their upstream README untouched.
const vendoredAddons = new Set(["odoo_test_xmlrunner"]);

// Every authored addon that carries editable readme/ fragments gets its README.rst
// and static/description/index.html regenerated; addons without fragments are skipped.
const addonDirs = readdirSync(path.join(repoRoot, "addons"), {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && !vendoredAddons.has(entry.name))
  .map((entry) => `addons/${entry.name}`)
  .filter((addonDir) => existsSync(path.join(repoRoot, addonDir, "readme")))
  .sort();

for (const addonDir of addonDirs) {
  const addonName = path.basename(addonDir);

  execFileSync(
    "oca-gen-addon-readme",
    [
      "--org-name",
      orgName,
      "--repo-name",
      repoName,
      "--branch",
      branch,
      "--addon-dir",
      addonDir,
      "--no-commit",
    ],
    {cwd: repoRoot, stdio: "inherit"}
  );

  // Maintainer-tools derives the GitHub module path from basename(addonDir), so
  // nested addon roots need a deterministic normalization after generation.
  const replacements = [
    [
      `https://github.com/${orgName}/${repoName}/tree/${branch}/${addonName}`,
      `https://github.com/${orgName}/${repoName}/tree/${branch}/${addonDir}`,
    ],
    [
      `https://raw.githubusercontent.com/${orgName}/${repoName}/${branch}/${addonName}/`,
      `https://raw.githubusercontent.com/${orgName}/${repoName}/${branch}/${addonDir}/`,
    ],
  ];

  for (const generatedFile of [
    `${addonDir}/README.rst`,
    `${addonDir}/static/description/index.html`,
  ]) {
    const filePath = path.join(repoRoot, generatedFile);
    let content = readFileSync(filePath, "utf8");
    for (const [from, to] of replacements) {
      content = content.replaceAll(from, to);
    }
    writeFileSync(filePath, content);
  }
}
