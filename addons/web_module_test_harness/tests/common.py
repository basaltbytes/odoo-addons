import contextlib
import logging
import os
import time

import psutil

from odoo import tests

from odoo.addons.web.tests.test_js import HOOTCommon, unit_test_error_checker

_logger = logging.getLogger(__name__)


@tests.tagged("post_install", "-at_install")
class ModuleHootCase(HOOTCommon):
    module_name = None
    route = None
    login = "admin"
    browser_timeout = 3600
    success_signal = "[HOOT] Test suite succeeded"
    hoot_preset = "desktop"
    hoot_timeout = 15000
    # The browser suite occasionally hits an intermittent hoot module-load race:
    # the first test file's top-level `describe.current.tags(...)` runs with an
    # empty suite stack -> "Cannot read properties of undefined (reading
    # 'configure')" -> 0 tests -> "Some js test failed". It is a test-infra
    # flake (~1 in 3 page loads), not a product failure, and every `browser_js`
    # is a fresh Chrome + page load, so retry the whole suite a few times before
    # failing. A genuine failure still fails on every attempt.
    hoot_retries = 2

    @classmethod
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if cls is ModuleHootCase or "test_unit_desktop" in cls.__dict__:
            return

        @tests.no_retry
        def test_unit_desktop(self):
            self._run_module_suite()

        cls.test_unit_desktop = test_unit_desktop

    def _get_route(self):
        if self.route:
            return self.route
        if not self.module_name:
            raise AssertionError("ModuleHootCase requires `module_name` or `route`.")
        return f"/web/module_tests/{self.module_name}"

    def _get_test_url(self):
        return (
            f"{self._get_route()}?headless&loglevel=2"
            f"&preset={self.hoot_preset}"
            f"&timeout={self.hoot_timeout}"
            f"{self.hoot_filters}"
        )

    def _run_module_suite(self):
        for attempt in range(self.hoot_retries + 1):
            try:
                try:
                    self.browser_js(
                        self._get_test_url(),
                        "",
                        "",
                        login=self.login,
                        timeout=self.browser_timeout,
                        success_signal=self.success_signal,
                        error_checker=unit_test_error_checker,
                    )
                finally:
                    self._reap_chrome_crashpad_zombies()
                return
            except AssertionError:
                if attempt >= self.hoot_retries:
                    raise
                _logger.warning(
                    "Hoot suite %s failed (attempt %d/%d); retrying — known "
                    "flaky hoot module-load race.",
                    self._get_route(),
                    attempt + 1,
                    self.hoot_retries + 1,
                )

    def _reap_chrome_crashpad_zombies(self):
        current_process = psutil.Process()
        for attempt in range(3):
            reaped = False
            for child in current_process.children(recursive=False):
                with contextlib.suppress(psutil.Error):
                    if (
                        child.name() != "chrome_crashpad"
                        or child.status() != psutil.STATUS_ZOMBIE
                    ):
                        continue
                    with contextlib.suppress(ChildProcessError, OSError):
                        if os.waitpid(child.pid, os.WNOHANG)[0]:
                            reaped = True
            if reaped or attempt == 2:
                return
            time.sleep(0.05)
