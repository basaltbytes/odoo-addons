# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Addon
versions follow Odoo's `19.0.x.y.z` scheme in each manifest.

## [Unreleased]

### Changed

- pnpm resolves only versions published at least 3 days ago (`pnpm-workspace.yaml`),
  matching Dependabot's cooldown, so Dependabot npm updates stop failing on young
  lockfile entries.

### Added

- `web_field_change_confirm`: a `confirm_change="<expression>"` attribute on form
  fields. Before a save that changes such a field, a dialog shows its old and new value
  and asks for confirmation.
- `web_module_test_harness`: run the Hoot tests of one addon from a Python test.
- `odoo_test_xmlrunner` (OCA 18.0 addon, ported to 19.0): JUnit XML test reports.
