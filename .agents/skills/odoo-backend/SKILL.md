---
name: odoo-backend
description: "Use when working on Odoo 19 server-side code or backend tests: Python models, ORM recordsets, fields/decorators, domains, SQL/cache, `__manifest__.py`, XML/CSV data, ACLs/rules, `sudo`, controllers, `@route`, `ir.cron`, JSON-2/XML-RPC, QWeb reports, `TransactionCase`, `HttpCase`, `Form`, tours, `start_tour`, or `--test-tags`. Not for web-client JS, Owl internals, Hoot, frontend assets, views, or widgets."
metadata:
  author: Philippe L'ATTENTION
  version: "2026.4.22"
  source: Generated from https://github.com/odoo/documentation, scripts located at https://github.com/basaltbytes/skills
---

> The skill is based on Odoo 19.0 backend and external API documentation, generated at 2026-04-22.

# Odoo 19 Backend

Use this for Odoo-specific server behavior agents often get wrong. It skips generic Python, ORM, and XML material. Load only the narrowest reference that matches the task.

## Quick Route

| If the task is about... | Read |
| --- | --- |
| `__manifest__.py`, XML/CSV loading, `record`/`function` tags, `noupdate` | [core-module-structure-and-data](references/core-module-structure-and-data.md) |
| recordsets, `_inherit`, `_inherits`, reserved fields, constraint/index attrs | [core-orm-models-recordsets](references/core-orm-models-recordsets.md) |
| computed/related fields, `@api.depends`, `@api.onchange`, `@api.constrains`, `@api.model_create_multi`, `@api.private` | [core-fields-and-decorators](references/core-fields-and-decorators.md) |
| domains, `search_fetch`, `_read_group`, raw SQL, `SQL(...)`, flushing, cache invalidation, `modified(...)` | [core-domains-sql-and-cache](references/core-domains-sql-and-cache.md) |
| ACL CSVs, record rules, `sudo`, field `groups=`, RPC exposure, SQL injection, `safe_eval`, escaping HTML | [core-security-acl-and-rules](references/core-security-acl-and-rules.md) |
| action dicts, `ir.actions.server`, `ir.cron`, `_commit_progress` | [features-actions-and-cron](references/features-actions-and-cron.md) |
| Python controllers, `@route`, request env, controller inheritance | [features-controllers-and-http](references/features-controllers-and-http.md) |
| external integrations, bearer-key JSON-2, `/json/2`, legacy XML-RPC / JSON-RPC `execute_kw` | [features-external-api-and-rpc](references/features-external-api-and-rpc.md) |
| QWeb PDF/HTML reports, paper formats, custom `_get_report_values`, report assets/fonts | [features-qweb-reports](references/features-qweb-reports.md) |
| `mail.thread`, aliases, activities, common backend mixins | [features-common-mixins](references/features-common-mixins.md) |
| `TransactionCase`, `HttpCase`, `Form`, `--test-tags`, tours, query-count assertions | [testing-backend-and-tours](references/testing-backend-and-tours.md) |
| profiling, batching, prefetch, query budgets, indexes | [performance-profiling-and-batching](references/performance-profiling-and-batching.md) |
| final review pass, Odoo 19 deltas, common regressions | [best-practices-odoo-19-backend](references/best-practices-odoo-19-backend.md) |

## Backend Defaults

- Model methods may receive empty or multi-record `self`; enforce singleton semantics explicitly.
- Public model methods are RPC-reachable. Keep security in Python, ACLs, and rules, not only in views.
- Prefer ORM. If SQL is necessary, flush before reads/writes and invalidate cache after writes.
- Batch by default: `_read_group`, batch `create`, recordset-aware loops, and query-count checks catch most regressions.
- Keep real invariants on models, not only in `onchange`, cron wrappers, or controllers.
- Before shipping, read [best-practices-odoo-19-backend](references/best-practices-odoo-19-backend.md).

## Cross-Skill Guidance

- Use the [odoo router](../odoo/SKILL.md) when the request is broad, ambiguous, or spans multiple Odoo domains.
- Use the [odoo-frontend skill](../odoo-frontend/SKILL.md) when the task is primarily web-client JavaScript, views, widgets, arch XML, or frontend assets.
- Use the [odoo-javascript-testing skill](../odoo-javascript-testing/SKILL.md) when the task is Hoot, web test helpers, mock-server work, or frontend JS testing internals.
