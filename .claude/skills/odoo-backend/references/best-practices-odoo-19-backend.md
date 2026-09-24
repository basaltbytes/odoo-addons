---
name: best-practices-odoo-19-backend
description:
  Final review checklist for Odoo 19 backend work, including version-specific API
  shifts, common anti-patterns, and the fastest sanity checks before shipping.
---

# Odoo 19 Backend Best Practices

Use this as the last pass after you already know which backend surface you are touching.

## Version-specific reminders

- Prefer `Domain(...)` composition over hand-built domain lists when logic is
  non-trivial.
- Prefer `_read_group` for backend grouping work; backend `read_group` is deprecated in
  favor of `_read_group`.
- `@api.private` exists to mark non-RPC helpers explicitly.
- Prefer `search_fetch(...)` or `fetch(...)` when cache warming matters.
- Prefer `odoo.tools.SQL(...)` over handwritten SQL strings.
- Stop using `record._cr`, `record._uid`, and `record._context`; use `env.cr`,
  `env.uid`, and `env.context`.

## Review checklist

- [ ] The method works on empty, singleton, and multi-record `self` where applicable.
- [ ] Singleton-only methods call `ensure_one()`.
- [ ] Public methods do not trust `self`, params, context, or caller-supplied IDs
      blindly.
- [ ] ACLs and record rules were considered together.
- [ ] `sudo()` is scoped narrowly and does not leak privileged recordsets back into
      normal flows.
- [ ] Dynamic field access uses `record[field_name]`, not `getattr(...)`.
- [ ] ORM is used before raw SQL; if SQL is used, it flushes first and invalidates after
      writes.
- [ ] Computed fields declare accurate dependencies and do not hide invariants in
      `onchange`.
- [ ] Batch work uses `_read_group`, batch `create`, or recordset-wide searches instead
      of per-record queries.
- [ ] External integrations use JSON-2 unless a legacy RPC client must be maintained.
- [ ] Tests cover the intended contract, and query counts are asserted when performance
      is the point.

## High-signal anti-patterns

| Anti-pattern                                                | Why it hurts                                            | Fix                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Overriding `create()` without `@api.model_create_multi`     | Breaks or slows batch creation                          | Use multi-create override shape                                   |
| Doing security only in views or client actions              | RPC, controllers, and direct writes still hit the model | Enforce in Python, ACLs, and rules                                |
| Using `onchange` for invariants                             | Only covers form editing                                | Move invariants to business methods or constraints                |
| Raw SQL `UPDATE` without `invalidate_*` and `modified(...)` | Stale cache and skipped recomputes                      | Flush, write SQL, invalidate, mark modified                       |
| Broad `sudo()` around business logic                        | Silently bypasses access rules and company isolation    | Restrict the privileged part and return to the normal env quickly |
| Separate `search` then `read` in external integrations      | Two network calls and a concurrency window              | Use `search_read` or one custom server-side method                |
| Calling cron logic from normal code paths                   | Scheduler semantics differ                              | Extract a shared helper and keep the cron wrapper thin            |
| Multiple global record rules                                | Easy to over-restrict                                   | Prefer fewer globals and explicit group rules                     |

## Treat as high-risk

If the patch changes any of these, expect regressions unless tested:

- security
- multi-company behavior
- stored computed fields
- scheduled jobs
- raw SQL
- external APIs
- reports
