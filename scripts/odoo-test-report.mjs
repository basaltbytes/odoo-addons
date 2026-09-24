#!/usr/bin/env node

// Human- and CI-facing summary of the JUnit/xUnit XML reports written by the vendored
// OCA `odoo_test_xmlrunner` runner (Python `unittest-xml-reporting`, XMLTestRunner) into
// `addons/test_results/*.xml` after an `oad test` run. It surfaces failing tests and
// their tracebacks without grepping logs. It is a reporter, not a gate: the test command
// itself is the gate, so this script always exits 0.

import {appendFileSync, existsSync, readFileSync, readdirSync, statSync} from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputDir = process.argv[2];
const reportsDir = inputDir
  ? path.resolve(inputDir)
  : path.resolve(repoRoot, "addons/test_results");

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

function paint(code, text) {
  return useColor ? `[${code}m${text}[0m` : text;
}

const red = (text) => paint("31", text);
const green = (text) => paint("32", text);
const bold = (text) => paint("1", text);

// Turn `&amp; &lt; &gt; &quot; &apos; &#xNN; &#NN;` back into their characters. Runs the
// numeric refs first and `&amp;` last so a decoded `&` is never re-interpreted.
function unescapeEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_match, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Decode failure/error body text that xmlrunner writes either as literal CDATA (kept
// verbatim) or as XML-escaped text (entity-decoded), possibly mixing both.
function decodeContent(raw) {
  const parts = [];
  let lastIndex = 0;
  for (const match of raw.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) {
    parts.push(unescapeEntities(raw.slice(lastIndex, match.index)));
    parts.push(match[1]);
    lastIndex = match.index + match[0].length;
  }
  parts.push(unescapeEntities(raw.slice(lastIndex)));
  return parts.join("");
}

// Read a double- or single-quoted XML attribute value out of a raw tag attribute string.
function getAttr(attrs, name) {
  const pattern = `\\b${name}\\s*=\\s*"([^"]*)"|\\b${name}\\s*=\\s*'([^']*)'`;
  const match = attrs.match(new RegExp(pattern));
  return match ? (match[1] ?? match[2]) : undefined;
}

function toInt(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Extract the `<failure>`/`<error>` child of a testcase body, if any. A `<skipped/>`
// child returns null, so skipped tests never count as failures.
function parseFailure(body) {
  const match = body.match(/<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/);
  if (!match) {
    return null;
  }
  const attrs = match[2];
  return {
    type: match[1] === "error" ? "ERROR" : "FAIL",
    message: unescapeEntities(getAttr(attrs, "message") ?? ""),
    traceback: decodeContent(match[3] ?? "").trim(),
  };
}

// Lazy attribute matches (`[^>]*?`) let `/>` win for self-closing tags; a greedy
// match swallowed the slash and ran the body to the next closing tag, attributing
// a failure to the passing test before it.
function parseCases(inner) {
  const cases = [];
  for (const match of inner.matchAll(
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g
  )) {
    const body = match[2];
    if (!body) {
      // Self-closing testcase: a passing test with no child element.
      continue;
    }
    const failure = parseFailure(body);
    if (failure) {
      cases.push({
        classname: unescapeEntities(getAttr(match[1], "classname") ?? ""),
        name: unescapeEntities(getAttr(match[1], "name") ?? ""),
        ...failure,
      });
    }
  }
  return cases;
}

function parseSuite(attrs, inner) {
  return {
    name: unescapeEntities(getAttr(attrs, "name") ?? "(unnamed suite)"),
    tests: toInt(getAttr(attrs, "tests")),
    failures: toInt(getAttr(attrs, "failures")),
    errors: toInt(getAttr(attrs, "errors")),
    skipped: toInt(getAttr(attrs, "skipped")),
    cases: parseCases(inner),
  };
}

// Accept either a single `<testsuite>` root or a `<testsuites>` wrapper with children.
function parseSuites(xml) {
  const suites = [];
  for (const match of xml.matchAll(
    /<testsuite\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testsuite>)/g
  )) {
    suites.push(parseSuite(match[1], match[2] ?? ""));
  }
  return suites;
}

function parseFile(file) {
  const mtime = statSync(file).mtime;
  try {
    return {file, mtime, suites: parseSuites(readFileSync(file, "utf8"))};
  } catch (error) {
    const name = `${path.basename(file)} (unreadable: ${error.message})`;
    return {
      file,
      mtime,
      suites: [{name, tests: 0, failures: 0, errors: 0, skipped: 0, cases: []}],
    };
  }
}

function noReportsNote() {
  return `no test reports found in ${reportsDir} — run a test profile first (see docs/agents/testing.md)`;
}

function overviewLine(suite, mtime) {
  const time = mtime.toTimeString().slice(0, 8);
  const failing = suite.failures + suite.errors > 0;
  const label = failing ? red(suite.name) : green(suite.name);
  const counts = `${suite.tests} tests, ${suite.failures} failed, ${suite.errors} error(s), ${suite.skipped} skipped`;
  return `${label}  ${counts}  [${time}]`;
}

function failureBlock(failCase) {
  const head = `${failCase.type} ${failCase.classname}.${failCase.name}`;
  const detail = failCase.traceback || failCase.message || "(no traceback captured)";
  const indented = detail
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `${red(head)}\n${indented}`;
}

function countByType(failingCases, type) {
  return failingCases.filter((failCase) => failCase.type === type).length;
}

// Failures come first: on CI the suite list runs to a hundred lines and the one
// traceback that matters must not sit below it.
function printConsole(reportSuites, failingCases, totals) {
  console.log(
    bold(`Odoo test reports — ${reportSuites.length} suite(s) in ${reportsDir}`)
  );
  console.log("");
  const headline = markdownSummaryLine(reportSuites, failingCases, totals);
  console.log(failingCases.length === 0 ? green(headline) : red(headline));
  if (failingCases.length > 0) {
    console.log("");
    console.log(bold("Failures"));
    for (const failCase of failingCases) {
      console.log("");
      console.log(failureBlock(failCase));
    }
  }
  console.log("");
  for (const {suite, mtime} of reportSuites) {
    console.log(overviewLine(suite, mtime));
  }
}

// One GitHub annotation per failing test, so the PR checks tab names it without
// opening the job log.
function printAnnotations(failingCases) {
  if (process.env.GITHUB_ACTIONS !== "true") {
    return;
  }
  for (const failCase of failingCases) {
    const title = `${failCase.type} ${failCase.classname}.${failCase.name}`;
    const detail = (failCase.message || failCase.traceback || "").trim().split("\n");
    const last = detail.at(-1) ?? "";
    const escape = (text) =>
      text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
    const props = `title=${escape(title).replace(/,/g, "%2C").replace(/:/g, "%3A")}`;
    console.log(`::error ${props}::${escape(last)}`);
  }
}

// Escape a Markdown table/summary cell: neutralise the pipe that would split a row.
function mdCell(text) {
  return text.replace(/\|/g, "\\|");
}

function markdownSummaryLine(reportSuites, failingCases, totals) {
  const failCount = countByType(failingCases, "FAIL");
  const errCount = countByType(failingCases, "ERROR");
  const tail = `across ${reportSuites.length} suites (${totals.tests} tests)`;
  if (failingCases.length === 0) {
    return `All green — 0 failed, 0 error(s) ${tail}.`;
  }
  return `${failCount} failed, ${errCount} error(s) ${tail}.`;
}

function failureDetails(failCase) {
  const title = `${failCase.type} ${failCase.classname}.${failCase.name}`;
  const body = failCase.traceback || failCase.message || "(no traceback captured)";
  return [
    "<details>",
    `<summary>${mdCell(title)}</summary>`,
    "",
    "```",
    body.replace(/```/g, "ʼʼʼ"),
    "```",
    "",
    "</details>",
    "",
  ];
}

function renderMarkdown(reportSuites, failingCases, totals) {
  const lines = [
    "### Odoo test reports",
    "",
    markdownSummaryLine(reportSuites, failingCases, totals),
    "",
  ];
  for (const failCase of failingCases) {
    lines.push(...failureDetails(failCase));
  }
  lines.push(
    "<details>",
    `<summary>All ${reportSuites.length} suites</summary>`,
    "",
    "| Suite | Tests | Failures | Errors | Skipped |",
    "| --- | ---: | ---: | ---: | ---: |"
  );
  for (const {suite} of reportSuites) {
    lines.push(
      `| ${mdCell(suite.name)} | ${suite.tests} | ${suite.failures} | ${suite.errors} | ${suite.skipped} |`
    );
  }
  lines.push("", "</details>", "");
  return lines.join("\n");
}

function main() {
  if (!existsSync(reportsDir) || !statSync(reportsDir).isDirectory()) {
    console.log(noReportsNote());
    return;
  }
  const xmlFiles = readdirSync(reportsDir)
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .map((name) => path.join(reportsDir, name));
  if (xmlFiles.length === 0) {
    console.log(noReportsNote());
    return;
  }

  const reports = xmlFiles
    .map(parseFile)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  // Flatten to per-suite rows, most recent file first, keeping each file's mtime.
  const reportSuites = reports.flatMap((report) =>
    report.suites.map((suite) => ({suite, mtime: report.mtime}))
  );
  const failingCases = reportSuites.flatMap(({suite}) => suite.cases);
  const totals = reportSuites.reduce(
    (acc, {suite}) => ({tests: acc.tests + suite.tests}),
    {tests: 0}
  );

  printConsole(reportSuites, failingCases, totals);
  printAnnotations(failingCases);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      renderMarkdown(reportSuites, failingCases, totals)
    );
  }
}

main();
