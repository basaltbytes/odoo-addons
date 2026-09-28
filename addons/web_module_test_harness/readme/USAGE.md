To run the Hoot tests of an addon, `my_addon` in these examples, you need to:

Declare the tests in a `my_addon.assets_unit_tests` bundle, in the manifest of
`my_addon`:

```python
"assets": {
    "my_addon.assets_unit_tests": [
        "my_addon/static/tests/**/*",
    ],
},
```

Add a test class that inherits from `ModuleHootCase`, and import it in
`tests/__init__.py`:

```python
from odoo import tests

from odoo.addons.web_module_test_harness.tests.common import ModuleHootCase


@tests.tagged("post_install", "-at_install")
class TestMyAddonHoot(ModuleHootCase):
    module_name = "my_addon"
```

Install `web_module_test_harness` in the test database, then run:

```bash
odoo-bin -d <db> --test-enable --stop-after-init \
  -i web_module_test_harness,my_addon \
  --test-tags /my_addon:TestMyAddonHoot
```

To run the tests in the browser, open `/web/module_tests/my_addon`. The page returns a
404 error if `my_addon` isn't installed or has no `my_addon.assets_unit_tests` bundle.

## Test class attributes

`module_name`: the addon whose tests the class runs. Required unless `route` is set.

`route`: the URL to open instead of `/web/module_tests/<module_name>`.

`login`: the user that opens the page. Default: `admin`.

`hoot_preset`: the Hoot preset. Default: `desktop`.

`hoot_timeout`: the time in milliseconds after which a test fails. Default: `15000`.

`hoot_retries`: how many times the class runs the tests again after a failure. Default:
`2`.

## Run the tests in `/web/tests` too

To also run the tests in Odoo's `/web/tests` page, include the bundle in
`web.assets_unit_tests`:

```python
"assets": {
    "my_addon.assets_unit_tests": [
        "my_addon/static/tests/**/*",
    ],
    "web.assets_unit_tests": [
        ("include", "my_addon.assets_unit_tests"),
    ],
},
```
