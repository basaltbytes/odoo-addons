{
    "name": "Field Change Confirmation",
    "summary": "Ask for confirmation, with before and after values, before saving "
    "a change to a sensitive form field",
    "version": "19.0.1.0.0",
    "license": "LGPL-3",
    "author": "basaltbytes",
    "website": "https://github.com/basaltbytes/odoo-addons",
    "category": "Extra Tools",
    "depends": ["web"],
    "assets": {
        "web.assets_backend": [
            "web_field_change_confirm/static/src/**/*",
        ],
        "web_field_change_confirm.assets_unit_tests": [
            "web_field_change_confirm/static/tests/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
