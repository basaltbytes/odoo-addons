import logging
import os

from odoo.tools import config

_logger = logging.getLogger(__name__)

# True once the XMLTestRunner patch is applied. The module's own smoke test
# skips itself when the patch is inactive (unwritable report directory).
active = False


def _resolve_result_directory():
    configured = config.get("test_result_directory")
    if configured:
        return configured
    # 19.0 port deviation: the upstream default ("test_results" relative to
    # the process cwd) is unwritable in containerized stacks whose cwd is /.
    # Default to a test_results folder inside the addons directory shipping
    # this module — with a bind-mounted addons folder the reports then land
    # on the host (addons/test_results in this repository).
    module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(os.path.dirname(module_dir), "test_results")


if config["test_enable"]:
    from xmlrunner import XMLTestRunner
    from xmlrunner.result import _XMLTestResult

    from odoo.tests.result import OdooTestResult
    from odoo.tests.suite import OdooSuite

    _result_directory = _resolve_result_directory()
    try:
        os.makedirs(_result_directory, exist_ok=True)
        _writable = os.access(_result_directory, os.W_OK)
    except OSError:
        _writable = False

    if not _writable:
        # 19.0 port deviation: never break the suite because reporting is
        # unavailable — fall back to the stock runner with a loud warning.
        _logger.warning(
            "cannot create or write to the test result directory %r; "
            "XML test reports are disabled for this run",
            _result_directory,
        )
    else:
        active = True

        unpatched_run = OdooSuite.run

        def run(self, result):
            test_result_directory = _resolve_result_directory()
            # create test result directory if not exists
            os.makedirs(test_result_directory, exist_ok=True)

            # Suite run method will be called by the XMLTestRunner,
            # so we need to run the original run method
            unpatched_sub_run = self.run
            self.run = lambda result, debug=False: unpatched_run(self, result, debug)
            # Override : XMLTestRunner to run the tests and generate XML reports
            try:
                results = XMLTestRunner(
                    output=test_result_directory,
                    verbosity=2,
                ).run(self)
            finally:
                self.run = unpatched_sub_run

            result.update(results)
            return result

        OdooSuite.run = run

        unpatched_update = OdooTestResult.update

        def update(self, other):
            # Adapt _XMLTestResult to OdooTestResult
            if isinstance(other, _XMLTestResult):
                self.failures_count += len(other.failures)
                self.errors_count += len(other.errors)
                self.skipped += len(other.skipped)
                self.testsRun += other.testsRun
            else:
                unpatched_update(self, other)

        OdooTestResult.update = update
