Add to your odoo Configuration file:

- **test_result_directory**: The path (created if it does not exist) where the reports
  will be written to.

19.0 port note (this repository's vendored copy): when **test_result_directory** is not
set, reports default to a `test_results` folder inside the addons directory that ships
this module — through the dockerized stack's bind mount that is `addons/test_results/`
on the host — instead of the upstream default, a folder relative to the Odoo process
working directory, which is not writable in containerized stacks. When the directory
cannot be created or written, the module logs a warning and leaves the stock test
runner untouched instead of breaking the suite.
