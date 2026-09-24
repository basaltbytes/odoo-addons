Install the addon together with the consumer addon, then add a tiny subclass of
`odoo.addons.web_module_test_harness.tests.common.ModuleHootCase`:

```python
from odoo import tests
from odoo.addons.web_module_test_harness.tests.common import ModuleHootCase


@tests.tagged("post_install", "-at_install")
class TestMyAddonHoot(ModuleHootCase):
    module_name = "my_addon"
```

Then run the targeted browser test class with:

```bash
./odoo/odoo-bin -d <db> --test-enable \
  --test-tags '/my_addon:TestMyAddonHoot' \
  --stop-after-init -u web,web_module_test_harness,my_addon
```

## Bundle convention

Consumer addons should declare their frontend tests in a dedicated bundle:

```python
"assets": {
    "my_addon.assets_unit_tests": [
        "my_addon/static/tests/**/*",
    ],
}
```

If the addon must also keep participating in the standard global Odoo suite, it can
include that dedicated bundle back into `web.assets_unit_tests`:

```python
"assets": {
    "my_addon.assets_unit_tests": [
        "my_addon/static/tests/**/*",
    ],
    "web.assets_unit_tests": [
        ("include", "my_addon.assets_unit_tests"),
    ],
}
```
