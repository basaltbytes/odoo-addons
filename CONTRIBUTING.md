# Contributing

## Setup

```bash
pnpm setup      # pnpm install, pre-commit hook, Odoo type sync, environment check
pnpm dev:setup  # Odoo test stack (Docker, via oad)
```

Re-run `pnpm setup` whenever something seems off.

## Workflow

1. Branch from `main`.
2. Add or change addon code.
   - New addon: `../odoo/odoo-bin scaffold -t ./scaffold-template <name> addons`
   - Declare every new `static/src/` file in the addon's `__manifest__.py` `assets`.
3. Ship the change complete: tests, `readme/` fragments, `fr.po` + `.pot` entries, and a
   `CHANGELOG.md` line (see "Definition of done" in [`AGENTS.md`](AGENTS.md)).
4. Run the gates:
   ```bash
   pnpm format && pnpm lint && pnpm typecheck
   pnpm format:python && pnpm lint:python
   pnpm hooks:check     # ruff, OCA module and .po checks, README generation
   pnpm test:odoo       # Python + Hoot tests
   ```
5. Commit. The pre-commit hook runs the same checks and regenerates READMEs; commit what
   it rewrites.
6. Open a PR against `main`. CI runs the static checks, the README drift check and the
   Odoo tests.

## Missing types

Keep the typecheck strict: add a declaration under `types/` and reference it from the
module that needs it.
