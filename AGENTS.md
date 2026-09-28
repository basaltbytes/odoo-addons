# AGENTS.md

**basaltbytes/odoo-addons** contains Odoo 19 Community addons that basaltbytes publishes
for reuse. An addon here must work for any company, so don't put a customer's name, data
or workflow in one. `CLAUDE.md` is a symlink to this file.

Related documents:

- [`README.md`](./README.md): the addon list, installation and requirements.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md): the contributor workflow.
- [`CHANGELOG.md`](./CHANGELOG.md): release notes.

## Layout

Each addon is a folder directly under `addons/`. That folder is the only one mounted in
the Odoo container, and Odoo only finds a manifest one level below it.

| Path                                                                | Contents                                                                                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `addons/web_field_change_confirm`, `addons/web_module_test_harness` | Addons written in this repository.                                                                                                              |
| `addons/odoo_test_xmlrunner`                                        | Vendored: a 19.0 port of OCA's 18.0 addon (OCA/server-tools). The linters and formatters ignore it. Change only what the port to 19.0 requires. |
| `scaffold-template/`                                                | Template for `odoo-bin scaffold -t`.                                                                                                            |
| `types/`                                                            | Hand-written type declarations. `pnpm sync:odoo-types` fills `types/odoo-upstream/`, which git ignores.                                         |
| `.agents/skills/`, `.claude/skills/`                                | Agent skills. See [Skills](#skills).                                                                                                            |

## Commands

All commands are `package.json` scripts. Run them with pnpm from the repository root.

| When                                          | Run                                          |
| --------------------------------------------- | -------------------------------------------- |
| After you change JavaScript, SCSS or Markdown | `pnpm format`, `pnpm lint`, `pnpm typecheck` |
| After you change Python                       | `pnpm format:python`, `pnpm lint:python`     |
| Before you open a PR                          | `pnpm hooks:check`                           |
| To run the Odoo tests                         | `pnpm test:odoo`                             |
| To read test failures                         | `pnpm test:report`                           |

`pnpm hooks:check` runs every pre-commit hook on all files: Ruff, the OCA module and
translation checks, README generation, oxfmt and oxlint.

Don't run tests with `../odoo/odoo-bin`. The tests need the oad Docker stack, which has
Chromium and the test addons installed. Use `../odoo/odoo-bin` only for `scaffold`.

Don't remove the version pins for pnpm (`packageManager` in `package.json`), Node
(`.node-version`) or pyenv (`.python-version`).

`pnpm-workspace.yaml` makes pnpm install only package versions published at least 3 days
ago, which matches Dependabot's cooldown. `pnpm install` doesn't re-resolve a version
that's already in the lockfile. To re-resolve everything under the 3-day rule, delete
`node_modules` and `pnpm-lock.yaml`, then run `pnpm install`.

## Branches and PRs

Create branches from `main` and open PRs against `main`. Issues and PRs are on GitHub at
`basaltbytes/odoo-addons`. Fill in the checklist from
`.github/PULL_REQUEST_TEMPLATE.md`.

## Definition of done

A PR that changes behavior includes the code and the four items below. A PR that only
edits comments, or refactors without changing behavior, doesn't need them.

1. **Tests.** Put Python tests in `tests/` and import each test module in
   `tests/__init__.py`; Odoo doesn't run a module that isn't imported, and CI still
   passes. Put web client tests in `static/tests/` as Hoot tests.
2. **Readme fragments.** Edit `readme/*.md` in English, with `##` for the top-level
   headings of a fragment. `pnpm gen:readme` generates `README.rst` and
   `static/description/index.html` from the fragments, and the pre-commit hook runs it
   for you. Commit both generated files, because CI fails if they're out of date. The
   generator requires the pandoc version set in `package.json` (`config.pandocVersion`).
   Don't add a `README.md` to an addon.
3. **Translations.** Add every user-facing string to both `i18n/<addon>.pot` and
   `i18n/fr.po`. This includes strings in JS `_t()` calls and static text in OWL and
   QWeb templates.
4. **Changelog.** Add a line under `## [Unreleased]` in `CHANGELOG.md`.

Some changes require other updates:

| Change                                 | Also update                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You add an addon                       | Add it to the table in `README.md`. In `odoo-agentic-dev.config.ts`, add it to `database.initialModules` and to the `runtime` test profile; if you skip either, `pnpm test:odoo` and CI don't run its tests. If the addon has Hoot tests, add its Hoot test class to the `hoot` profile too. |
| You vendor a third-party addon         | Add it to the exclude lists in `.pre-commit-config.yaml`, `.ruff.toml`, `.oxlintrc.json`, `.oxfmtrc.json` and `scripts/gen-addon-readmes.mjs`.                                                                                                                                               |
| You change the dev workflow or tooling | Update `CONTRIBUTING.md`, the PR template and this file wherever they describe what you changed.                                                                                                                                                                                             |

## Skills

The skills in `.agents/skills/` are copies from `basaltbytes/skills`, and
`skills-lock.json` records the hash of each one, so don't edit them here.
`.claude/skills/` has a symlink to each of them and also contains the skills specific to
this repository. The linters and formatters ignore both folders.

| Task                                                           | Skill                        |
| -------------------------------------------------------------- | ---------------------------- |
| Python models, data files, security, controllers, Python tests | `odoo-backend`               |
| Assets, registries, patches, views, field widgets              | `odoo-frontend`              |
| Owl components, hooks, reactivity                              | `owl`                        |
| Hoot tests                                                     | `odoo-19-javascript-testing` |
| A task that covers several of the rows above                   | `odoo`                       |
| Domain modeling, error handling, deciding what to test         | `coding-guidelines`          |
| Test-first work                                                | `tdd`                        |
| Readme fragments, changelog entries, other prose               | `anti-slop-writing`          |

The `coding-guidelines` charter applies without exception to code that doesn't import
Odoo, such as `scripts/`. In Odoo models, views and Owl components, use Odoo's own
constructs where the charter would suggest something else: recordsets instead of value
objects, `@api.constrains` and SQL constraints for invariants, `UserError` and
`ValidationError` for errors.

## Coding standards

Name addons and fields after what they do. Don't use a customer name or a vendor prefix.

### JavaScript

- `pnpm typecheck` checks the JavaScript with `checkJs`. Add JSDoc wherever a type would
  otherwise be `any`: public methods, values used across files, parser outputs, service
  interfaces. The JSDoc must describe what the code does at runtime and promise nothing
  more. If an Odoo declaration is missing, add it under `types/`. `tsconfig.json`
  configures the editor and has `checkJs` off, so don't validate with it.
- Check that `assets` in the addon's `__manifest__.py` includes every file you add under
  `static/src/`, in the same PR. The typecheck doesn't detect a missing entry, and at
  runtime Odoo doesn't load the file.
- To change web client behavior, look for an Odoo extension point first: a registry, a
  controller hook such as `onWillSaveRecord`, or `js_class`. Patch only when no
  extension point covers the case. In a patch, patch prototype methods and call `super`.
  List in a comment every private web client API the patch reads, and write a test that
  fails when one of those APIs changes.
- Owl passes reactive proxies to components, so `a === b` can be false for the same
  record. Compare records with `toRaw(a) === toRaw(b)`.
- A custom widget in a form must update when the record changes. Declare the fields it
  reads in `fieldDependencies`, and reload its data after a header action finishes and
  after a dialog closes. If the user has to reload the page to see current data, that's
  a bug.
- `useService("orm")` returns an ORM bound to the component: if the component unmounts
  while a call is in flight, the promise never resolves or rejects. For a call that must
  complete after the component unmounts, use `env.services.orm`.

### Python

Use Odoo's constructs: recordsets, constraints, `UserError` and `ValidationError`. Keep
action and wizard methods short, and put each business rule in a named method with its
own test.

Write a docstring with a one-line imperative summary on every entry point, meaning
`action_*` methods, cron methods, methods called over RPC and `onchange` handlers.

Don't add type annotations to models. No type checker runs on the Python code and Odoo
has no type stubs, so nothing would verify them.

## Testing

Odoo tests run in a Docker stack managed by
[oad](https://www.npmjs.com/package/@basaltbytes/odoo-agentic-dev) and configured in
`odoo-agentic-dev.config.ts`. Run `pnpm dev:setup` once per checkout to build it.

| Command                                          | Runs                                              |
| ------------------------------------------------ | ------------------------------------------------- |
| `pnpm test:odoo`                                 | Every Python and Hoot test. CI runs this.         |
| `pnpm test:hoot`                                 | Hoot tests only.                                  |
| `pnpm exec oad test --tags /<addon>:<TestClass>` | One test class. Use this while you work.          |
| `pnpm exec oad test --tags /<addon>`             | All tests of one addon, including its Hoot tests. |

`oad test` recreates the test database, so stop a running stack with `pnpm dev:down`
before you run it.

Each run writes JUnit XML reports to `addons/test_results/`. `pnpm test:report` prints
the failed tests with their tracebacks.

### Hoot tests

`web_module_test_harness` runs the Hoot tests of one addon from a Python test. To add
Hoot tests to an addon, declare a `<addon>.assets_unit_tests` bundle in its manifest and
add a `tests/test_js.py` that subclasses `ModuleHootCase` with
`module_name = "<addon>"`; `web_field_change_confirm/tests/test_js.py` is an example.
Don't add the harness to the addon's `depends`, because the test stack installs it.

Chromium and the Python test packages are installed in the Docker image by `odoo.build`
in the oad config. `oad test` doesn't rebuild the image. After you edit `odoo.build`,
run `pnpm exec oad test --build` once.

### Results that look like a pass

A run that reports `0 tests` has failed, even when the exit code is 0. So has a run
where Odoo skips the Hoot tests because `websocket-client` is missing. Find the cause in
both cases.

When a test fails intermittently, find the cause and fix it; don't re-run until it
passes. Delete a test when the behavior it checks no longer exists.

## Local environment

oad creates one Docker stack per git worktree and branch. Each stack has its own
database, ports and Compose project, so two sessions can run at the same time.

| Command                           | Effect                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                        | Starts the stack.                                               |
| `pnpm dev:down`                   | Stops it.                                                       |
| `pnpm dev:info`                   | Prints the database name, ports and URLs.                       |
| `pnpm dev:reset-db`               | Drops the database and initializes it again.                    |
| `pnpm exec oad run -- <cmd>`      | Runs a host command with the stack's environment variables set. |
| `pnpm exec oad compose -- <args>` | Runs Docker Compose on this stack.                              |

Don't set those environment variables by hand, and don't call `docker compose` directly:
oad generates the compose file in `.odoo-agentic-dev/`, which git ignores.

oad identifies a stack by its branch name. If you rename a branch after you start work,
oad builds a new stack from scratch and the old one is orphaned, so rename before you
start.

## Odoo source

Read the Odoo source before you use an upstream API; don't rely on memory.

The `paths` in `tsconfig.json` point to an Odoo 19 checkout at `../odoo`, so that the
editor can open `@web/*`, `@odoo/hoot` and similar imports. To search the source from a
shell inside this repository, run `pnpm exec oad link-source --target ../odoo`, which
creates a `.odoo/` symlink at the root.

Don't edit anything in `../odoo` or `.odoo/`, because the change would go to the Odoo
repository. Git, the linters and the formatters all ignore `.odoo/`.

## Translations

Add new strings by hand to both `fr.po` and the `.pot`, next to the existing entries.
`pnpm i18n:update <addon> [lang]` exports from the oad database. Don't regenerate a
whole `.pot` from a database that doesn't have the addon's data, because the export
would be missing entries.

Keep the `#:` reference line on every entry. Odoo 19 doesn't load a translation that has
no reference, and it reports no error.

Git merges `.po` and `.pot` files with the `odoo-po` union driver, which
`.gitattributes` declares and `pnpm install` configures. After a merge or a rebase, run
`pnpm i18n:format` to put the catalog back in canonical form. The driver only runs on
your machine. GitHub's web merge doesn't use it, so rebase locally when a PR conflicts
on a catalog.
