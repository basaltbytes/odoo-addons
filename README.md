# basaltbytes Odoo addons

Reusable addons for Odoo 19 Community.

| Addon                                                                            | Summary                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`web_field_change_confirm`](addons/web_field_change_confirm)                    | Ask for confirmation, with before and after values, before saving a change to a sensitive form field |
| [`web_module_test_harness`](addons/web_module_test_harness)                      | Run one addon's Hoot test suite from a Python test                                                   |
| [`odoo_test_xmlrunner`](addons/odoo_test_xmlrunner) _(OCA 18.0, ported to 19.0)_ | JUnit XML reports for Odoo test runs                                                                 |

Each addon documents its configuration and usage in its own `README.rst`.

## Install

Add this repository's `addons/` folder to Odoo's `addons_path`, then install the addons
you need from the Apps menu.

## Develop

Requirements: Node (see `.node-version`) with pnpm, Python 3.10–3.13, Docker for the
test stack, and `pandoc` at the version pinned in `package.json` for README generation.

```bash
pnpm setup        # dependencies, pre-commit hook, Odoo type sync, environment check
pnpm dev:setup    # build the Odoo test stack (oad)
pnpm test:odoo    # run every addon's Python and Hoot tests
```

Contribution rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`AGENTS.md`](AGENTS.md).

## License

Authored addons are licensed under LGPL-3 (see [`LICENSE`](LICENSE)). Vendored addons
keep their upstream license, stated in their manifest.
