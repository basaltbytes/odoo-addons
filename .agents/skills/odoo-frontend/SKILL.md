---
name: odoo-frontend
description: "Use when working on Odoo 19 web-client customizations in JavaScript or arch XML: assets, `@odoo-module`, registries, services, systray/client actions, browser state, `patch(...)`, view descriptors, `js_class`, `searchModel`, modifiers, `options=`, XPath inheritance, built-in/custom views, field/view widgets, `standardFieldProps`, or `extractProps`. Not for backend ORM, Hoot tests, Owl internals, or generic JS/Owl."
metadata:
  author: Philippe L'ATTENTION
  version: "2026.4.22"
  source: Generated from https://github.com/odoo/documentation, merged with source-verified view references from https://github.com/odoo/odoo, expanded with tutorial-derived frontend patterns from master_odoo_web_framework, cross-checked against local solution addons in `sources/odootutorials`, then manually trimmed to the highest-signal agent guidance; scripts located at https://github.com/basaltbytes/skills
---

> The skill is based on Odoo 19.0 documentation, source-verified view references, tutorial-derived frontend patterns, and local solved tutorial addons, then trimmed on 2026-04-22 to keep only high-signal Odoo-specific frontend guidance.

# Odoo 19 Frontend

Use this for Odoo-specific web-client wiring and arch parser quirks, not generic frontend theory. It intentionally skips generic Owl, JS, QWeb, editor/mobile APIs, and testing APIs.

## Quick Route

Do not read every reference up front. Start from the slice that matches the task.

| If the task is about... | Read |
| --- | --- |
| Asset bundles, manifest operations, lazy asset loading, named lazy bundles, `LazyComponent`, `loadJS`, `@odoo-module`, aliases, import rules | [core-assets-and-modules](references/core-assets-and-modules.md) |
| Registry categories, sequence ordering, systray, `main_components`, `command_provider`, `lazy_components`, action registry | [core-registries-and-extension-points](references/core-registries-and-extension-points.md) |
| Systray items, popover client actions, command-palette actions, shared service state, `Reactive` models, browser-backed persistence | [features-client-actions-and-shared-state](references/features-client-actions-and-shared-state.md) |
| Safe, minimal use of `patch(...)` | [features-patching-code](references/features-patching-code.md) |
| View descriptor, `Controller` / `Renderer` / `Model` / `ArchParser`, or `WithSearch` resolution | [view-architecture](references/view-architecture.md) |
| Build a brand-new view type or customize one via `js_class` | [view-registration](references/view-registration.md), then [custom-view-minimal](examples/custom-view-minimal.md) or [gallery-view-full](examples/gallery-view-full.md) |
| Extend a built-in kanban with a sidebar, `searchModel`, `fuzzyLookup`, or `t-model` | [advanced-kanban-customization](references/advanced-kanban-customization.md) |
| Built-in view archs for `kanban`, `graph`, `pivot`, `calendar`, `search` | [built-in-views](references/built-in-views.md) |
| Root tags, modifiers, `options=`, `groups=`, or removed `attrs=` / `states=` patterns | [arch-xml](references/arch-xml.md) |
| Add, move, replace, or mutate nodes with XPath inheritance | [view-inheritance](references/view-inheritance.md), then [view-inheritance example](examples/view-inheritance.md) |
| Author a custom `<field widget="...">` | [field-widgets](references/field-widgets.md), then [field-widget example](examples/field-widget.md) |
| Author a custom `<widget name="...">` | [view-widgets](references/view-widgets.md), then [view-widget example](examples/view-widget.md) |
| Need a full custom-view scaffold instead of a minimal one | [gallery-view-full](examples/gallery-view-full.md) |

## Mental Model

A view is five pieces glued together by `registry.category("views")`:

| Piece | Role | Standard impl |
| --- | --- | --- |
| `ArchParser` | Reads XML into `archInfo`. Synchronous, no Owl. | Custom per view type |
| `Model` | Data layer. | `RelationalModel` or a custom model |
| `Renderer` | Pure Owl component. Draws `model.root`. Never fetches. | Custom per view type |
| `Controller` | Root Owl component. Owns layout and wires Model to Renderer. | Custom per view type |
| View descriptor | Plain object with `type`, `Controller`, `Renderer`, `Model`, `ArchParser`, `props`, and optional extras | Required |

A sixth optional `Compiler` converts arch XML into Owl templates at runtime for views such as `form` and `kanban`. Use [view-architecture](references/view-architecture.md) for the full descriptor catalogue and runtime resolution path.

## Red Flags

| Pattern | Status | Fix |
| --- | --- | --- |
| `attrs="{'invisible': [...]}"` | Removed in 17. Raises `ValidationError`. | Put `invisible=`, `readonly=`, or `required=` directly on the node |
| `states="draft,confirmed"` | Removed in 17 | Rewrite as a direct expression, e.g. `invisible="state not in ('draft', 'confirmed')"` |
| `<tree>` root | Removed in 17 | Use `<list>` |
| `JSON.parse(options)` on `<field>` | Wrong. `<field options>` is py.js, not strict JSON. | Trust the parsed `options` in `extractProps` |
| Skipping `JSON.parse` on `<button options=...>` | Wrong in the other direction | Parse button options as JSON |
| Mutating `record.data` directly | Bypasses model machinery | Use `record.update({...})` |
| Reading raw arch attrs inside a component | Leaks parsing concerns into rendering | Parse in `extractProps` and pass clean props |
| Custom widget without standard props | Breaks prop validation and runtime expectations | Spread `standardFieldProps` or `standardWidgetProps` |
| New file under `static/src/` not referenced in `__manifest__.py` | Loads 0 bytes at runtime | Add it to the right asset bundle in the same diff |

## Working Style

- Start by reading the target addon's `__manifest__.py`, XML arch, and existing `static/src` files. In Odoo, most frontend bugs are wiring mistakes before they are logic mistakes.
- Prefer registries, descriptor overrides, or composition before `patch(...)`.
- For `js_class` customizations, spread the built-in descriptor instead of copying it.
- Parse arch attributes and options in `extractProps`; keep components ignorant of raw arch XML.
- Use the examples as scaffolding, not as canonical contracts. For exact behavior, read the nearest parser or descriptor in Odoo source.

## Cross-Skill Guidance

- Use the [odoo router](../odoo/SKILL.md) when the request is broad, ambiguous, or spans multiple Odoo domains.
- Use the [owl skill](../owl/SKILL.md) when the task is about Owl component internals, lifecycle, reactivity, props, slots, or template semantics.
- Use the [odoo-javascript-testing skill](../odoo-javascript-testing/SKILL.md) when the task needs Hoot assertions, `mountWithCleanup`, `mountView`, `defineModels`, or mock-server control.
