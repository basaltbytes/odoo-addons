Odoo's `/web/tests` page runs the Hoot tests of every installed addon, from the
`web.assets_unit_tests` bundle. This technical addon adds a page that runs the Hoot
tests of one addon, and a Python test class that opens this page in Chromium. With it,
`--test-tags` can select the JavaScript tests of a single addon, like its Python tests.

The addon doesn't change `/web/tests` or `web.assets_unit_tests`.
