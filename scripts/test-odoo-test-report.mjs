import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import process from "node:process";
import {test} from "node:test";

const script = new URL("./odoo-test-report.mjs", import.meta.url).pathname;

function report(files, env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "odoo-test-report-"));
  for (const [name, xml] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), xml);
  }
  const summary = path.join(dir, "summary.md");
  const stdout = execFileSync("node", [script, dir], {
    encoding: "utf8",
    // The runner exports GITHUB_ACTIONS=true; pin it so each test decides.
    env: {
      ...process.env,
      NO_COLOR: "1",
      GITHUB_ACTIONS: "false",
      GITHUB_STEP_SUMMARY: summary,
      ...env,
    },
  });
  return {stdout, summary: readFileSync(summary, "utf8")};
}

// The xmlrunner writes passing tests as self-closing <testcase/> elements.
const suite = `<testsuite name="odoo.addons.demo.tests.TestDemo-1" tests="3" failures="0" errors="1" skipped="0">
<testcase classname="odoo.addons.demo.tests.TestDemo" name="test_passes" time="0.1"/>
<testcase classname="odoo.addons.demo.tests.TestDemo" name="test_breaks" time="0.2"><error type="StopIteration" message="">Traceback (most recent call last):
  File "test_demo.py", line 7, in test_breaks
StopIteration</error></testcase>
<testcase classname="odoo.addons.demo.tests.TestDemo" name="test_passes_too" time="0.1"/>
</testsuite>`;
const green = `<testsuite name="odoo.addons.other.tests.TestGreen-1" tests="2" failures="0" errors="0" skipped="0"><testcase classname="c" name="a"/><testcase classname="c" name="b"/></testsuite>`;

test("a failure is attributed to the failing test, not the passing one before it", () => {
  const {stdout, summary} = report({"a.xml": suite, "b.xml": green});
  assert.match(stdout, /ERROR odoo\.addons\.demo\.tests\.TestDemo\.test_breaks/);
  assert.doesNotMatch(stdout, /test_passes\b/);
  assert.match(summary, /<summary>ERROR .*test_breaks<\/summary>/);
});

test("failures come before the suite list in the console and the job summary", () => {
  const {stdout, summary} = report({"a.xml": suite, "b.xml": green});
  assert.ok(stdout.indexOf("Failures") < stdout.indexOf("TestGreen-1  2 tests"));
  assert.match(stdout, /^0 failed, 1 error\(s\) across 2 suites \(5 tests\)\.$/m);
  assert.ok(summary.indexOf("<summary>ERROR") < summary.indexOf("| Suite |"));
  assert.match(summary, /<summary>All 2 suites<\/summary>/);
});

test("GitHub Actions gets one error annotation per failing test", () => {
  const {stdout} = report({"a.xml": suite}, {GITHUB_ACTIONS: "true"});
  const annotations = stdout.split("\n").filter((line) => line.startsWith("::error "));
  assert.deepEqual(annotations, [
    "::error title=ERROR odoo.addons.demo.tests.TestDemo.test_breaks::StopIteration",
  ]);
  assert.doesNotMatch(report({"a.xml": suite}).stdout, /::error/);
});

test("an all-green run reports so and emits no annotation", () => {
  const {stdout, summary} = report({"b.xml": green}, {GITHUB_ACTIONS: "true"});
  assert.match(
    stdout,
    /All green — 0 failed, 0 error\(s\) across 1 suites \(2 tests\)\./
  );
  assert.doesNotMatch(stdout, /::error|Failures/);
  assert.doesNotMatch(summary, /<summary>(ERROR|FAIL)/);
});
