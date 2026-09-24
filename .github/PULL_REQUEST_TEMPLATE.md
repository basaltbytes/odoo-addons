## What

<!-- One or two sentences: what changes for the user or the developer, and why. -->

## How it was verified

<!-- Tests added or run, manual checks, screenshots for UI changes. -->

## Checklist

- [ ] Tests added or updated for the changed behavior (`pnpm test:odoo` passes)
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` pass
- [ ] `pnpm format:python:check`, `pnpm lint:python`, `pnpm hooks:check` pass
- [ ] New `static/src/` files are declared in the addon's `__manifest__.py` `assets`
- [ ] `readme/` fragments updated; generated `README.rst` and `index.html` committed
- [ ] New user-facing strings in both `fr.po` and the `.pot`
- [ ] `CHANGELOG.md` updated
