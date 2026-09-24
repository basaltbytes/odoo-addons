# Copyright 2026 Humans Connexion
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
"""Smoke coverage for the 19.0 port of the xmlrunner patch.

Runs a nested :class:`OdooSuite` of dummy ``unittest`` cases through the
patched ``OdooSuite.run`` and asserts that JUnit XML reports land in the
configured ``test_result_directory`` — including a failure entry that names
the failing test and carries its traceback (the reason this module exists).
"""

import os
from pathlib import Path
from tempfile import TemporaryDirectory

import odoo.modules.module
from odoo.tests import case
from odoo.tests.common import TransactionCase
from odoo.tests.result import OdooTestResult
from odoo.tests.suite import OdooSuite
from odoo.tools import config

from odoo.addons.odoo_test_xmlrunner.odoo_tests import loader

_UNSET = object()


class TestXmlReportGeneration(TransactionCase):
    def _run_nested_suite(self, test_cases, result_directory):
        suite = OdooSuite(test_cases)
        result = OdooTestResult()
        # OdooSuite.run reassigns the module-level current test marker to
        # each nested dummy case; restore the real one afterwards. The config
        # option is set/restored by hand: config.options is a ChainMap, which
        # unittest.mock.patch.dict would flatten on restore.
        previous_test = odoo.modules.module.current_test
        previous_dir = config.options.maps[0].get("test_result_directory", _UNSET)
        config.options["test_result_directory"] = result_directory
        try:
            suite.run(result)
        finally:
            if previous_dir is _UNSET:
                del config.options["test_result_directory"]
            else:
                config.options["test_result_directory"] = previous_dir
            odoo.modules.module.current_test = previous_test
        return result

    def test_report_written_with_failure_details(self):
        if not loader.active:
            self.skipTest("xmlrunner patch inactive (report directory not writable)")

        # Odoo's vendored suite accesses class attributes (__unittest_skip__)
        # that only its own TestCase defines, so the dummies subclass it.
        class DummyReportProbe(case.TestCase):
            def test_probe_pass(self):
                self.assertTrue(True)

            def test_probe_fail(self):
                self.fail("xmlrunner-probe-boom")

        with TemporaryDirectory() as tmpdir:
            result = self._run_nested_suite(
                [DummyReportProbe("test_probe_pass"), DummyReportProbe("test_probe_fail")],
                tmpdir,
            )
            reports = [name for name in os.listdir(tmpdir) if name.endswith(".xml")]
            self.assertTrue(reports, "expected at least one XML report file")
            content = "".join(
                Path(tmpdir, name).read_text(encoding="utf-8") for name in reports
            )

        # The nested counters merged back into the OdooTestResult, and the
        # report names the failing test with its traceback.
        self.assertEqual(result.testsRun, 2)
        self.assertEqual(result.failures_count, 1)
        self.assertEqual(result.errors_count, 0)
        self.assertIn("test_probe_fail", content)
        self.assertIn("xmlrunner-probe-boom", content)
        self.assertIn("Traceback", content)
