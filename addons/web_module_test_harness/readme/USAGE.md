The examples below add Hoot tests to an addon named `my_addon`.

Declare the tests in a bundle named `my_addon.assets_unit_tests`, in the manifest of
`my_addon`:

```python
"assets": {
    "my_addon.assets_unit_tests": [
        "my_addon/static/tests/**/*",
    ],
},
```

Add a test class that inherits from `ModuleHootCase`, and import its file in
`tests/__init__.py`:

```python
from odoo import tests

from odoo.addons.web_module_test_harness.tests.common import ModuleHootCase


@tests.tagged("post_install", "-at_install")
class TestMyAddonHoot(ModuleHootCase):
    module_name = "my_addon"
```

`my_addon` doesn't need `web_module_test_harness` in its `depends`, but the harness must
be installed in the test database. Run the tests with:

```bash
odoo-bin -d <db> --test-enable --stop-after-init \
  -i web_module_test_harness,my_addon \
  --test-tags /my_addon:TestMyAddonHoot
```

To run the tests in the Hoot interface, log in and open `/web/module_tests/my_addon`.
The page returns a 404 error if `my_addon` isn't installed or has no
`my_addon.assets_unit_tests` bundle.

## Test class attributes

`module_name`: the addon whose tests the class runs. Required unless you set `route`.

`route`: the URL to open instead of `/web/module_tests/<module_name>`.

`login`: the user that opens the page. Default: `admin`.

`hoot_preset`: the Hoot preset. Default: `desktop`.

`hoot_timeout`: the time in milliseconds after which a test fails. Default: `15000`.

`hoot_retries`: how many times the class runs the tests again after a failure. Default:
`2`.

## Keep the tests in `/web/tests`

To also run the tests of `my_addon` in Odoo's `/web/tests` page, include its bundle in
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
