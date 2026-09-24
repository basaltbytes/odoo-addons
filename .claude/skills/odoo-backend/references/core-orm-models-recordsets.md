---
name: core-orm-models-recordsets
description:
  Recordset behavior, inheritance modes, reserved fields, and the ORM rules that
  actually change how Odoo backend model code should be written.
---

# ORM Models and Recordsets

The generic ORM concepts are assumed. Keep this file for the recordset and inheritance
rules that regularly break backend patches.

## Model choice only matters at the edges

- `models.Model`: normal persisted records.
- `models.AbstractModel`: shared behavior or non-record helpers.
- `models.TransientModel`: wizard data; keep `_log_access` enabled.

## Recordsets are not single rows

```python
def action_confirm(self):
    for trip in self.filtered(lambda t: t.state == "draft"):
        trip.state = "confirmed"
```

- `self` may contain 0, 1, or many records.
- duplicates are still possible.
- iterating yields singletons.
- reading a scalar field on a multi-record recordset raises.

Use:

- `self.ensure_one()` when the method is singleton-only
- `self.mapped("field_name")` for non-relational multi-record reads
- set operations `|`, `&`, `-` when staying in recordset land

## Prefer field access that stays inside the ORM

Prefer `record[field_name]` over `getattr(record, field_name)` for dynamic field names
so the lookup stays inside ORM field semantics.

## Reserved fields with behavior attached

- `name`: display label source
- `active`: archive/unarchive support
- `parent_id`, `parent_path`: tree semantics and `child_of` / `parent_of`
- `company_id`: multi-company consistency checks

If you opt into tree semantics with `parent_path`, declare it with `index=True`.

## Constraints and indexes are model attributes

```python
from odoo import fields, models


class BusinessTrip(models.Model):
    _name = "business.trip"

    name = fields.Char(required=True)
    amount = fields.Float()
    limit = fields.Float()

    _amount_check = models.Constraint(
        "CHECK (amount <= limit)",
        "Amount must stay below the limit.",
    )
    _name_idx = models.Index("(name)")
```

This attribute-based path is the modern one documented in the ORM reference and
changelog.

## Inheritance modes

- Classical inheritance: new model name, borrowed behavior.
- Extension via `_inherit = "existing.model"`: patch an existing model in place.
- Delegation via `_inherits`: compose through a `Many2one` foreign key.

```python
class TripProfile(models.Model):
    _name = "trip.profile"

    seat_preference = fields.Char()


class BusinessTrip(models.Model):
    _name = "business.trip"
    _inherits = {"trip.profile": "profile_id"}

    profile_id = fields.Many2one("trip.profile", required=True, ondelete="cascade")
```

Warnings from the docs still apply:

- fields delegate, methods do not
- chained `_inherits` remains fragile
- avoid `_inherits` unless the composition benefit is real

## Field incremental definition

When extending a model, redefine a field with the same type to override attributes:

```python
class BusinessTrip(models.Model):
    _inherit = "business.trip"

    state = fields.Selection(help="Trip lifecycle state.")
```

Use this to refine metadata such as `help`, `tracking`, defaults, or labels without
redefining the whole model.
