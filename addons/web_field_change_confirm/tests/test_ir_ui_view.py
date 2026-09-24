from lxml import etree

from odoo.exceptions import ValidationError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestConfirmChangeAttribute(TransactionCase):
    def _create_partner_form(self, arch):
        return self.env["ir.ui.view"].create(
            {
                "name": "confirm_change test form",
                "model": "res.partner",
                "type": "form",
                "arch": arch,
            }
        )

    def test_fields_read_by_the_expression_are_added_to_the_view(self):
        view = self._create_partner_form(
            '<form><field name="name" confirm_change="is_company and not active"/></form>'
        )
        arch = self.env["res.partner"].get_views([(view.id, "form")])["views"]["form"][
            "arch"
        ]
        root = etree.fromstring(arch)
        self.assertEqual(
            root.xpath("//field[@name='name']/@confirm_change"),
            ["is_company and not active"],
        )
        for fname in ("is_company", "active"):
            added = root.xpath(f"//field[@name='{fname}']")
            self.assertEqual(len(added), 1, fname)
            self.assertEqual(added[0].get("invisible"), "True", fname)

    def test_an_invalid_expression_is_rejected(self):
        with self.assertRaisesRegex(ValidationError, "confirm_change"):
            self._create_partner_form(
                '<form><field name="name" confirm_change="is_company and"/></form>'
            )
