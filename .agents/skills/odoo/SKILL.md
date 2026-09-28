---
name: odoo
description: "Use when an Odoo request is broad, ambiguous, explicitly asks for a general or umbrella Odoo skill, or spans multiple Odoo 19 domains such as backend Python, XML data/views, web-client JavaScript, Owl, frontend tests, tours, reports, security, assets, registries, or widgets. Do not use for a clear single-slice task already covered by odoo-backend, odoo-frontend, odoo-javascript-testing, or owl."
---

# Odoo

This is a router skill. Do not duplicate Odoo technical guidance here or load every Odoo reference up front. Pick the narrowest skill that matches the task.

## Route

| Task shape | Use |
| --- | --- |
| Python ORM, manifests, XML/CSV data, ACLs, controllers, cron, reports, backend tests, tours | [odoo-backend](../odoo-backend/SKILL.md) |
| Web-client JS, assets, registries, services, patches, views, widgets, arch XML, XPath, `js_class` | [odoo-frontend](../odoo-frontend/SKILL.md) |
| Owl lifecycle, hooks, reactivity, props, slots, refs, templates, rendering, OWL 2 vs 3 risk | [owl](../owl/SKILL.md) |
| Hoot, web test helpers, `mountWithCleanup`, `mountView`, `contains`, `defineModels`, `onRpc`, mock server, fake time | [odoo-javascript-testing](../odoo-javascript-testing/SKILL.md) |

## Boundary Rules

- If the task clearly matches one narrower skill, use that skill directly and skip this router.
- If the task spans backend and frontend, load both matching Odoo skills, but still read only the specific references needed.
- If frontend implementation also needs Owl internals, pair `odoo-frontend` with `owl`.
- If frontend implementation also needs tests, pair `odoo-frontend` with `odoo-javascript-testing`.
