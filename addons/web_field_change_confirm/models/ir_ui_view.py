from odoo import models
from odoo.tools.view_validation import get_expression_field_names

# Form-field attribute holding a Python expression, evaluated client-side like
# `readonly`: when it is true and the field's value changes, the web client asks for
# confirmation before saving. Mirrored in static/src/field_change_confirm.js.
CONFIRM_CHANGE_ATTR = "confirm_change"


class IrUiView(models.Model):
    _inherit = "ir.ui.view"

    def _postprocess_attributes(self, node, name_manager, node_info):
        """Treat ``confirm_change`` like a native modifier: every field its expression
        reads is added to the view (invisible) when missing, so the client can
        evaluate it."""
        super()._postprocess_attributes(node, name_manager, node_info)
        expr = node.get(CONFIRM_CHANGE_ATTR)
        if expr:
            name_manager.must_have_fields(
                node,
                get_expression_field_names(expr),
                node_info,
                (CONFIRM_CHANGE_ATTR, expr),
            )

    def _validate_attributes(self, node, name_manager, node_info):
        """Reject an invalid ``confirm_change`` expression when the view is saved,
        like Odoo does for ``readonly`` or ``invisible``."""
        super()._validate_attributes(node, name_manager, node_info)
        expr = node.get(CONFIRM_CHANGE_ATTR)
        if expr:
            self._validate_expression(
                node,
                name_manager,
                expr,
                f"modifier {CONFIRM_CHANGE_ATTR!r}",
                node_info,
            )
