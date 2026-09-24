---
name: core-fields-and-decorators
description:
  "High-signal field patterns for Odoo 19 backend code: computed and related fields,
  date/datetime rules, and the decorators that control recomputation, validation, and
  RPC exposure."
---

# Fields and Decorators

Keep only the parts that change backend behavior. The generic field taxonomy is assumed
knowledge; the risky parts are recomputation, inverse behavior, and where decorators do
and do not run.

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
- Dependencies must be accurate; stale `@api.depends(...)` is a common source of
  incorrect values.
- Dotted dependencies like `line_ids.value` are supported.
- `store=True` makes the field searchable and groupable.
- Non-stored computed fields need `search=...` if they must appear in backend search
  domains.

## Avoid shared inverse methods across multiple fields

The ORM docs warn against sharing one inverse method across multiple fields. During
inverse computation, sibling inverse-backed fields may be protected and return `False`
from cache.

## Related fields are projection, not aggregation

```python
nickname = fields.Char(
    related="partner_id.name",
    store=True,
    depends=["partner_id"],
)
```

Use related fields for lightweight projection. Chaining through `One2many` or
`Many2many` to synthesize aggregated values is unsupported.

## Date and datetime gotchas

- Do not compare date strings to datetime strings.
- Prefer `fields.Date.to_date(...)`, `fields.Date.context_today(...)`, and
  `fields.Datetime.now()` over ad-hoc parsing.
- Datetimes are stored in UTC; client-side timezone handling does not make server-side
  string comparisons safe.

```python
date_from = fields.Date.to_date(self.env.context.get("date_from"))
deadline = fields.Datetime.now()
today = fields.Date.context_today(self)
```

## Decorators that matter most

### `@api.depends_context`

Use it when a computed value depends on context keys rather than only fields.

### `@api.constrains`

Use it for cross-field validation after `create()` or `write()`.

```python
@api.constrains("date_start", "date_end")
def _check_dates(self):
    for trip in self:
        if trip.date_end and trip.date_start and trip.date_end < trip.date_start:
            raise ValidationError("End date must be after start date.")
```

### `@api.onchange`

UI helper only. It updates in-memory form values; it is not a persistence, security,
import, or RPC guarantee.

### `@api.model_create_multi`

Prefer this on `create()` overrides so batch creation keeps working:

```python
@api.model_create_multi
def create(self, vals_list):
    for vals in vals_list:
        vals.setdefault("state", "draft")
    return super().create(vals_list)
```

### `@api.private`

Use it on internal helpers that should not be part of the public model API.

### `@api.ondelete`

Use it when the goal is preventing deletion under conditions, rather than mixing
validation and side effects into a broad `unlink()` override.
