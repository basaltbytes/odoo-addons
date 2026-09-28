---
name: core-fields-and-decorators
description: "High-signal field patterns for Odoo 19 backend code: computed and related fields, date/datetime rules, and the decorators that control recomputation, validation, and RPC exposure."
---

# Fields and Decorators

Use this for field behavior that changes correctness: recomputation, inverse behavior, date/datetime handling, and decorators.

- Rely on Odoo's registry setup to initialize a newly added stored field on existing rows from its field default; add a migration only when the backfill differs or needs conditions.

## Computed fields

```python
from odoo import api, fields, models


class BusinessTrip(models.Model):
    _name = "business.trip"

    amount = fields.Float()
    tax = fields.Float()
    total = fields.Float(compute="_compute_total", store=True)

    @api.depends("amount", "tax")
    def _compute_total(self):
        for record in self:
            record.total = record.amount + record.amount * record.tax
```

- Always assign the field for every record.
- Keep `@api.depends(...)` accurate; stale dependencies produce stale stored values.
- Dotted dependencies like `line_ids.value` are supported.
- `store=True` makes fields searchable/groupable; non-stored computed fields need `search=...` for domains.

## Inverse and Related Fields

- Do not share one inverse method across multiple fields; sibling inverse-backed fields can be protected and read as `False` from cache.
- Related fields are projection, not aggregation.
- Do not chain through `One2many` or `Many2many` to synthesize aggregate values.

```python
nickname = fields.Char(
    related="partner_id.name",
    store=True,
    depends=["partner_id"],
)
```

## Date and datetime gotchas

- Do not compare date strings to datetime strings.
- Prefer `fields.Date.to_date(...)`, `fields.Date.context_today(...)`, and `fields.Datetime.now()` over ad-hoc parsing.
- Datetimes are stored in UTC; client-side timezone handling does not make server-side string comparisons safe.

```python
date_from = fields.Date.to_date(self.env.context.get("date_from"))
deadline = fields.Datetime.now()
today = fields.Date.context_today(self)
```

## Decorators

| Decorator | Use |
| --- | --- |
| `@api.depends_context` | Computed value depends on context keys. |
| `@api.constrains` | Cross-field validation after `create()` / `write()`. |
| `@api.onchange` | UI-only in-memory form helper; not security, import, persistence, or RPC guarantee. |
| `@api.model_create_multi` | Required shape for efficient batch `create()` overrides. |
| `@api.private` | Internal helper that should not be public RPC API. |
| `@api.ondelete` | Conditional deletion prevention without broad `unlink()` side effects. |

```python
@api.model_create_multi
def create(self, vals_list):
    for vals in vals_list:
        vals.setdefault("state", "draft")
    return super().create(vals_list)
```
