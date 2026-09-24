---
name: odoo-frontend
description:
  "Use when creating, editing, debugging, or reviewing Odoo 19 web-client customizations
  in JavaScript or arch XML: asset bundles, `@odoo-module` imports, registries, systray
  items, client actions, command providers, browser-backed frontend state, `patch(...)`,
  view descriptors, `js_class`, `searchModel`, built-in or custom views, field widgets,
  view widgets, modifiers, `options=`, or XPath inheritance. Pair with `owl` for Owl
  internals and `odoo-19-javascript-testing` for Hoot and web test helpers. Do not use
  for backend ORM or generic Owl/JavaScript concepts."
metadata:
  author: Philippe L'ATTENTION
  version: "2026.4.22"
  source:
    Generated from https://github.com/odoo/documentation, merged with source-verified
    view references from https://github.com/odoo/odoo, expanded with tutorial-derived
    frontend patterns from master_odoo_web_framework, cross-checked against local
    solution addons in `sources/odootutorials`, then manually trimmed to the
    highest-signal agent guidance; scripts located at https://github.com/phildl/skills
---

> The skill is based on Odoo 19.0 documentation, source-verified view references,
> tutorial-derived frontend patterns, and local solved tutorial addons, then trimmed on
> 2026-04-22 to keep only high-signal Odoo-specific frontend guidance.

# Odoo 19 Frontend

This skill is for Odoo-specific extension points and parser quirks, not for generic
frontend theory. Start from the narrowest reference that matches the task, and load
examples only when you need paste-ready scaffolding.

It intentionally omits material an agent should already know or can recover cheaply from
local code: generic Owl semantics, generic services/hooks/components, classical QWeb
basics, editor/mobile APIs, and JS testing APIs.

## Quick Route

Do not read every reference up front. Start from the slice that matches the task.

| If the task is about...                                                                                                                      | Read                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset bundles, manifest operations, lazy asset loading, named lazy bundles, `LazyComponent`, `loadJS`, `@odoo-module`, aliases, import rules | [core-assets-and-modules](references/core-assets-and-modules.md)                                                                                                        |
| Registry categories, sequence ordering, systray, `main_components`, `command_provider`, `lazy_components`, action registry                   | [core-registries-and-extension-points](references/core-registries-and-extension-points.md)                                                                              |
| Systray items, popover client actions, command-palette actions, shared service state, `Reactive` models, browser-backed persistence          | [features-client-actions-and-shared-state](references/features-client-actions-and-shared-state.md)                                                                      |
| Safe, minimal use of `patch(...)`                                                                                                            | [features-patching-code](references/features-patching-code.md)                                                                                                          |
| View descriptor, `Controller` / `Renderer` / `Model` / `ArchParser`, or `WithSearch` resolution                                              | [view-architecture](references/view-architecture.md)                                                                                                                    |
| Build a brand-new view type or customize one via `js_class`                                                                                  | [view-registration](references/view-registration.md), then [custom-view-minimal](examples/custom-view-minimal.md) or [gallery-view-full](examples/gallery-view-full.md) |
| Extend a built-in kanban with a sidebar, `searchModel`, `fuzzyLookup`, or `t-model`                                                          | [advanced-kanban-customization](references/advanced-kanban-customization.md)                                                                                            |
| Built-in view archs for `kanban`, `graph`, `pivot`, `calendar`, `search`                                                                     | [built-in-views](references/built-in-views.md)                                                                                                                          |
| Root tags, modifiers, `options=`, `groups=`, or removed `attrs=` / `states=` patterns                                                        | [arch-xml](references/arch-xml.md)                                                                                                                                      |
| Add, move, replace, or mutate nodes with XPath inheritance                                                                                   | [view-inheritance](references/view-inheritance.md), then [view-inheritance example](examples/view-inheritance.md)                                                       |
| Author a custom `<field widget="...">`                                                                                                       | [field-widgets](references/field-widgets.md), then [field-widget example](examples/field-widget.md)                                                                     |
| Author a custom `<widget name="...">`                                                                                                        | [view-widgets](references/view-widgets.md), then [view-widget example](examples/view-widget.md)                                                                         |
| Need a full custom-view scaffold instead of a minimal one                                                                                    | [gallery-view-full](examples/gallery-view-full.md)                                                                                                                      |

## Mental Model

A view is five pieces glued together by `registry.category("views")`:

| Piece           | Role                                                                                                    | Standard impl                       |
| --------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `ArchParser`    | Reads XML into `archInfo`. Synchronous, no Owl.                                                         | Custom per view type                |
| `Model`         | Data layer.                                                                                             | `RelationalModel` or a custom model |
| `Renderer`      | Pure Owl component. Draws `model.root`. Never fetches.                                                  | Custom per view type                |
| `Controller`    | Root Owl component. Owns layout and wires Model to Renderer.                                            | Custom per view type                |
| View descriptor | Plain object with `type`, `Controller`, `Renderer`, `Model`, `ArchParser`, `props`, and optional extras | Required                            |

A sixth optional `Compiler` converts arch XML into Owl templates at runtime for views
such as `form` and `kanban`. Use [view-architecture](references/view-architecture.md)
for the full descriptor catalogue and runtime resolution path.

## Red Flags

| Pattern                                                          | Status                                              | Fix                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `attrs="{'invisible': [...]}"`                                   | Removed in 17. Raises `ValidationError`.            | Put `invisible=`, `readonly=`, or `required=` directly on the node                     |
| `states="draft,confirmed"`                                       | Removed in 17                                       | Rewrite as a direct expression, e.g. `invisible="state not in ('draft', 'confirmed')"` |
| `<tree>` root                                                    | Removed in 17                                       | Use `<list>`                                                                           |
| `JSON.parse(options)` on `<field>`                               | Wrong. `<field options>` is py.js, not strict JSON. | Trust the parsed `options` in `extractProps`                                           |
| Skipping `JSON.parse` on `<button options=...>`                  | Wrong in the other direction                        | Parse button options as JSON                                                           |
| Mutating `record.data` directly                                  | Bypasses model machinery                            | Use `record.update({...})`                                                             |
| Reading raw arch attrs inside a component                        | Leaks parsing concerns into rendering               | Parse in `extractProps` and pass clean props                                           |
| Custom widget without standard props                             | Breaks prop validation and runtime expectations     | Spread `standardFieldProps` or `standardWidgetProps`                                   |
| New file under `static/src/` not referenced in `__manifest__.py` | Loads 0 bytes at runtime                            | Add it to the right asset bundle in the same diff                                      |

## Working Style

- Start by reading the target addon's `__manifest__.py`, XML arch, and existing
  `static/src` files. In Odoo, most frontend bugs are wiring mistakes before they are
  logic mistakes.
- Prefer registries, descriptor overrides, or composition before `patch(...)`.
- For `js_class` customizations, spread the built-in descriptor instead of copying it.
- Parse arch attributes and options in `extractProps`; keep components ignorant of raw
  arch XML.
- Use the examples as scaffolding, not as canonical contracts. For exact behavior, read
  the nearest parser or descriptor in Odoo source.

## Core References

| Topic                           | Description                                                                                                | Reference                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Assets and Modules              | Bundles, manifest directives, lazy loading, named bundles, aliases, import rules, and loading failures     | [core-assets-and-modules](references/core-assets-and-modules.md)                                   |
| Registries and Extension Points | Ordered registries, `actions`, `systray`, `command_provider`, `lazy_components`, and custom registry slots | [core-registries-and-extension-points](references/core-registries-and-extension-points.md)         |
| Client Actions and Shared State | Tutorial-derived patterns for client actions, systray items, shared service state, and browser persistence | [features-client-actions-and-shared-state](references/features-client-actions-and-shared-state.md) |
| Patching Code                   | Safe patch timing, `super`, class vs prototype patching, and unpatching for tests                          | [features-patching-code](references/features-patching-code.md)                                     |

## Views and Widgets

| Topic                         | Description                                                                                                            | Reference                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| View Architecture             | Descriptor keys, runtime resolution, `View` / `WithSearch`, standard props contracts                                   | [view-architecture](references/view-architecture.md)                         |
| View Registration             | Add a new view type end-to-end or override one with `js_class`                                                         | [view-registration](references/view-registration.md)                         |
| Advanced Kanban Customization | Tutorial-derived patterns for sidebars, `searchModel`, `t-model`, and pager coordination in `js_class` kanban variants | [advanced-kanban-customization](references/advanced-kanban-customization.md) |
| Built-in Views                | Arch shapes and parser-backed attributes for Odoo's built-in view types                                                | [built-in-views](references/built-in-views.md)                               |
| Arch XML                      | Root tags, modifiers, `context`, `domain`, `groups`, `options`, and removed patterns                                   | [arch-xml](references/arch-xml.md)                                           |
| View Inheritance              | XPath positions, attribute combiners, `move`, and `mode="primary"` vs `extension`                                      | [view-inheritance](references/view-inheritance.md)                           |
| Field Widgets                 | `fields` registry, descriptor shape, `standardFieldProps`, `fieldDependencies`, writes                                 | [field-widgets](references/field-widgets.md)                                 |
| View Widgets                  | `view_widgets` registry, descriptor shape, `standardWidgetProps`, widget parsing                                       | [view-widgets](references/view-widgets.md)                                   |

## Examples

| Topic               | Description                                                               | Reference                                              |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| Minimal Custom View | Smallest runnable brand-new view type with Python, JS, and XML pieces     | [custom-view-minimal](examples/custom-view-minimal.md) |
| Gallery View        | Full custom view with model, renderer, pagination, and click-to-form flow | [gallery-view-full](examples/gallery-view-full.md)     |
| Field Widget        | Paste-ready custom `<field widget="color_pill">` example                  | [field-widget](examples/field-widget.md)               |
| View Widget         | Paste-ready custom `<widget name="banner">` example                       | [view-widget](examples/view-widget.md)                 |
| View Inheritance    | Common XPath snippets for adding, replacing, moving, and mutating nodes   | [view-inheritance](examples/view-inheritance.md)       |

## Cross-Skill Guidance

- Use the [owl skill](../owl/SKILL.md) when the task is about Owl component internals,
  lifecycle, reactivity, props, slots, or template semantics.
- Use the [odoo-19-javascript-testing skill](../odoo-19-javascript-testing/SKILL.md)
  when the task needs Hoot assertions, `mountWithCleanup`, `mountView`, `defineModels`,
  or mock-server control.
