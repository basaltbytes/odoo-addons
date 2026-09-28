---
name: best-practices-odoo-19-backend
description: Final review checklist for Odoo 19 backend work, including version-specific API shifts, common anti-patterns, and the fastest sanity checks before shipping.
---

# Odoo 19 Backend Best Practices

Use this as the final review pass after the narrower backend reference.

## Odoo 19 Reminders

- Prefer `Domain(...)` composition over hand-built domain lists when logic is non-trivial.
- Prefer `_read_group`; backend `read_group` is deprecated.
- `@api.private` exists to mark non-RPC helpers explicitly.
- Prefer `search_fetch(...)` or `fetch(...)` when cache warming matters.
- Prefer `odoo.tools.SQL(...)` over handwritten SQL strings.
- Use `env.cr`, `env.uid`, and `env.context`, not `record._cr`, `record._uid`, or `record._context`.

## Review Checklist

Check these before shipping:

- Recordsets: empty/single/multi `self`, with `ensure_one()` only where singleton-only.
- Security: public methods distrust `self`, params, context, and caller IDs; ACLs, rules, and Python checks agree.
- Privilege: `sudo()` is narrow and does not leak privileged recordsets.
- Fields/cache: computed dependencies are accurate; SQL flushes before reads and invalidates/marks modified after writes.
- Performance: batch `create`, `_read_group`, and recordset-wide searches replace per-record queries.
- Integrations/tests: use JSON-2 for new APIs; tests cover contracts and query counts when performance matters.

## High-Signal Anti-Patterns

| Anti-pattern | Why it hurts | Fix |
| --- | --- | --- |
| `create()` without `@api.model_create_multi` | Breaks/slows batch creation | Use multi-create shape |
| Security only in views/client actions | RPC/controllers/direct writes still hit models | Enforce in Python, ACLs, rules |
| Invariants in `onchange` | Only covers form editing | Move to business methods/constraints |
| SQL write without invalidation | Stale cache/skipped recomputes | Flush, SQL, invalidate, `modified` |
| Broad `sudo()` | Bypasses rules/company isolation | Scope privilege tightly |
| External `search` then `read` | Race window + two calls | Use `search_read` or a server method |
| Cron logic called normally | Scheduler semantics differ | Shared helper + thin cron wrapper |
| Many global rules | Intersect into surprise denials | Fewer globals, explicit group rules |

## High-Risk Change Areas

Expect tests for security, multi-company behavior, stored computed fields, scheduled jobs, raw SQL, external APIs, and reports.
