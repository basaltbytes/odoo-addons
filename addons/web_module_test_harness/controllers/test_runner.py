import re

from markupsafe import Markup

from odoo import http
from odoo.http import request
from odoo.modules.module import get_manifest

MODULE_NAME_PATTERN = re.compile(r"^[a-z0-9_]+$")


class WebModuleTestHarnessController(http.Controller):
    @staticmethod
    def _get_bundle_name(module_name):
        return f"{module_name}.assets_unit_tests"

    def _is_allowed_module(self, module_name):
        if not MODULE_NAME_PATTERN.fullmatch(module_name):
            return False

        module = (
            request.env["ir.module.module"]
            .sudo()
            .search(
                [("name", "=", module_name), ("state", "=", "installed")],
                limit=1,
            )
        )
        if not module:
            return False

        try:
            manifest_assets = get_manifest(module_name).get("assets", {})
        except (FileNotFoundError, KeyError, ValueError):
            return False

        return self._get_bundle_name(module_name) in manifest_assets

    @staticmethod
    def _render_asset_nodes(asset_nodes):
        rendered_nodes = []
        for tag_name, attributes in asset_nodes:
            attrs = Markup("").join(
                Markup(' {}="{}"').format(name, value)
                for name, value in attributes.items()
            )
            if tag_name == "script":
                rendered_nodes.append(Markup("<script{}></script>").format(attrs))
            else:
                rendered_nodes.append(Markup("<{}{} />").format(tag_name, attrs))
        return Markup("\n").join(rendered_nodes)

    @http.route(
        "/web/module_tests/<string:module_name>",
        type="http",
        auth="user",
        readonly=True,
    )
    def module_unit_tests_suite(self, module_name, **kwargs):
        if not self._is_allowed_module(module_name):
            raise request.not_found()

        bundle_name = self._get_bundle_name(module_name)
        asset_nodes = request.env["ir.qweb"]._get_asset_nodes(
            bundle_name,
            css=True,
            js=True,
            debug=kwargs.get("debug", request.session.debug),
            defer_load=True,
        )
        if not asset_nodes:
            raise request.not_found()

        return request.render(
            "web_module_test_harness.module_unit_tests_suite",
            {
                "module_name": module_name,
                "module_test_assets": self._render_asset_nodes(asset_nodes),
                "session_info": {
                    "view_info": request.env["ir.ui.view"].get_view_info(),
                },
            },
        )
