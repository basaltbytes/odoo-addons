from odoo import tests

from odoo.addons.web_module_test_harness.tests.common import ModuleHootCase


@tests.tagged("post_install", "-at_install")
class TestWebFieldChangeConfirmHoot(ModuleHootCase):
    module_name = "web_field_change_confirm"
