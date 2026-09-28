Add to your odoo Configuration file:

- **test_result_directory**: The path (created if not exists) where the reports will be written to.

## Changes in the 19.0 port

If **test_result_directory** isn't set, the reports go to a `test_results` folder in the
addons directory that contains this addon. In this repository, that's
`addons/test_results/`. Upstream, the default is `test_results` in Odoo's working
directory, which often isn't writable when Odoo runs in a container.

If the addon can't create or write to the report directory, it logs a warning and Odoo
runs the tests without writing XML reports.
