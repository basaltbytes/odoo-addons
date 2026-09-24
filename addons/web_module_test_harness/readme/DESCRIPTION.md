This technical addon adds a module-specific Hoot entry point for local development and
targeted CI runs without changing Odoo's standard frontend test suite.

The addon provides:

- a route at `/web/module_tests/<module_name>`
- a page that reuses `web.assets_unit_tests_setup`
- a module-specific test bundle convention named `<module_name>.assets_unit_tests`
- a reusable Python base class for browser-driven Hoot tests

This is additive. It does not replace `/web/tests` or the normal `web.assets_unit_tests`
flow used by standard Odoo CI.
