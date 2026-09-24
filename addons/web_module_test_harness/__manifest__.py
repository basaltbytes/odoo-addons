{
    "name": "Web Module Test Harness",
    "summary": "Module-scoped Hoot test runner for Odoo 19 addons",
    "version": "19.0.1.0.0",
    "license": "LGPL-3",
    "author": "basaltbytes",
    "company": "https://basaltbytes.com",
    "category": "Hidden",
    "depends": ["web"],
    "data": [
        "views/module_test_templates.xml",
    ],
    "assets": {
        "web_module_test_harness.assets_unit_tests_setup": [
            "web_module_test_harness/static/src/js/module_test_harness_worker_service.js",
        ],
        "web_module_test_harness.assets_unit_tests_bootstrap": [
            "web/static/tests/**/*",
            ("remove", "web/static/tests/**/*.test.js"),
            ("remove", "web/static/tests/legacy/**/*"),
            ("remove", "web/static/tests/tours/**/*"),
        ],
        "web_module_test_harness.assets_unit_tests": [
            "web_module_test_harness/static/tests/module_test_harness.test.js",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
