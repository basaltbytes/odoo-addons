Add to your odoo Configuration file:

- **test_result_directory**: The path (created if not exists) where the reports will be written to.

## Changes in the 19.0 port

- The default **test_result_directory** is a `test_results` folder in the addons
  directory that contains this addon.
- If the report directory can't be created or written to, the addon logs a warning and
  the tests run without XML reports.
