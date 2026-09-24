---
name: core-domains-sql-and-cache
description:
  Domain builder patterns, search/read APIs, `_read_group`, `search_fetch`, and the
  correct raw-SQL workflow with `SQL`, flushing, invalidation, and recomputation.
---

# Domains, SQL, and Cache

This is the main correctness and performance boundary in Odoo backend work. Most
regressions here come from per-record queries, stale cache after SQL, or domains
assembled unsafely.

## Compose domains with `Domain(...)`

```python
from odoo.fields import Domain

domain = Domain("invoice_status", "=", "to invoice") & Domain(
    "order_line",
    "any",
    Domain("product_id.qty_available", "<=", 0),
)
```

Prefer `Domain(...)` when logic is composed, reused, or partially caller-driven. It is
easier to validate and safer than mutating raw list fragments.

Useful operators that are easy to forget:

- hierarchy: `child_of`, `parent_of`
- relational existence: `any`, `not any`
- dynamic date parts and relative values

```python
Domain("birthday.month_number", "=", 2)
Domain("deadline", "<", "today")
Domain("deadline", ">=", "=monday -1w")
```

## Query APIs that change outcomes

- `search_fetch(...)`: combine search and cache warming when you know the next field
  reads.
- `fetch(fields)`: warm an existing recordset.
- `_read_group(...)`: preferred backend aggregation API; the changelog deprecates
  backend `read_group`.

## `_read_group` is often the fix for N+1 counters

```python
def _compute_expense_count(self):
    counts = self.env["business.expense"]._read_group(
        [("trip_id", "in", self.ids)],
        ["trip_id"],
        ["__count"],
    )
    count_by_trip = dict(counts)
    for trip in self:
        trip.expense_count = count_by_trip.get(trip, 0)
```

## Keep prefetch working

Good:

```python
partners = self.env["res.partner"].browse(partner_ids)
for partner in partners:
    partner.name
    partner.lang
```

Bad:

```python
for partner_id in partner_ids:
    partner = self.env["res.partner"].browse(partner_id)
    partner.name
```

## Raw SQL: use `SQL(...)`, not interpolation

```python
from odoo.tools import SQL

self.env["business.trip"].flush_model(["state"])
self.env.cr.execute(
    SQL("SELECT id FROM business_trip WHERE state = %s"),
    ["draft"],
)
trip_ids = [row[0] for row in self.env.cr.fetchall()]
```

Raw SQL bypasses ORM security, record rules, and cache semantics. Treat it as an escape
hatch, not the default.

## Flush before SQL reads

Use the narrowest flush that makes the query correct:

- `self.env.flush_all()`
- `model.flush_model(["field"])`
- `records.flush_recordset(["field"])`

## Invalidate after SQL writes

```python
from odoo.tools import SQL

Trip = self.env["business.trip"]
Trip.flush_model(["state"])
self.env.cr.execute(
    SQL("UPDATE business_trip SET state = %s WHERE state = %s RETURNING id"),
    ["confirmed", "draft"],
)
ids = [row[0] for row in self.env.cr.fetchall()]
records = Trip.browse(ids)
records.invalidate_recordset(["state"])
records.modified(["state"])
```

Sequence:

1. flush relevant fields
2. execute SQL
3. invalidate caches
4. call `modified(...)` if computed-field dependencies changed

## Prefer framework helpers when they already encode cache behavior

The ORM reference exposes `Environment.execute_query(...)`. Use higher-level helpers
when they fit instead of scattering raw cursor calls everywhere.
