---
name: core-orm-models-recordsets
description: Recordset behavior, inheritance modes, reserved fields, and the ORM rules that actually change how Odoo backend model code should be written.
---

# ORM Models and Recordsets

Use this for recordset and inheritance rules that regularly break backend patches.

## Model Types

Use `models.Model` for persisted records, `models.AbstractModel` for shared behavior/non-record helpers, and `models.TransientModel` for wizards. Keep `_log_access` enabled on transient models.

## Recordsets are not single rows

```python
def action_confirm(self):
    for trip in self.filtered(lambda t: t.state == "draft"):
        trip.state = "confirmed"
```

- `self` may contain 0, 1, or many records.
- Duplicates are possible.
- Iterating yields singletons.
- Reading a scalar field on a multi-record recordset raises.

Use `ensure_one()` for singleton-only methods, `mapped(...)` for multi-record reads, and set operations `|`, `&`, `-` when staying in recordset land.

## Prefer field access that stays inside the ORM

Prefer `record[field_name]` over `getattr(record, field_name)` for dynamic field names so the lookup stays inside ORM field semantics.

## Behavior-Attached Reserved Fields

`name` drives display labels; `active` enables archive/unarchive; `parent_id` + indexed `parent_path` enable tree semantics and `child_of` / `parent_of`; `company_id` enables multi-company consistency checks.

## Constraints and Indexes

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

## Inheritance Modes

- Classical: `_name` + `_inherit` for a new model with borrowed behavior.
- Extension: `_inherit = "existing.model"` to patch an existing model in place.
- Delegation: `_inherits = {"x": "x_id"}` to compose through a `Many2one` FK.

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

- fields delegate, methods do not;
- chained `_inherits` remains fragile;
- avoid `_inherits` unless the composition benefit is real.

## Field incremental definition

```python
class BusinessTrip(models.Model):
    _inherit = "business.trip"

    state = fields.Selection(help="Trip lifecycle state.")
```

Use this to refine metadata such as `help`, `tracking`, defaults, or labels without redefining the whole model.
