from odoo import tests

from .common import ModuleHootCase


@tests.tagged("post_install", "-at_install")
class TestModuleTestHarnessRoute(tests.HttpCase):
    def setUp(self):
        super().setUp()
        self.authenticate("admin", "admin")

    def test_module_suite_route_renders_target_bundle_only(self):
        response = self.url_open("/web/module_tests/web_module_test_harness")

        self.assertEqual(response.status_code, 200)
        self.assertIn("web.assets_unit_tests_setup", response.text)
        self.assertIn("web_module_test_harness.assets_unit_tests", response.text)
        self.assertNotIn("web.assets_unit_tests.min.js", response.text)
        bootstrap_index = response.text.index(
            "web_module_test_harness.assets_unit_tests_bootstrap"
        )
        target_index = response.text.index(
            "web_module_test_harness.assets_unit_tests.min.js"
        )
        self.assertLess(bootstrap_index, target_index)

    def test_module_suite_route_rejects_modules_without_dedicated_bundle(self):
        response = self.url_open("/web/module_tests/base")
        self.assertEqual(response.status_code, 404)


@tests.tagged("post_install", "-at_install")
class TestModuleTestHarnessHoot(ModuleHootCase):
    module_name = "web_module_test_harness"
