---
name: features-common-mixins
description: "The common backend mixins worth reusing before inventing custom plumbing: chatter, aliases, and activities."
---

# Common Mixins

Use shipped mixins before inventing custom chatter, email alias, or activity plumbing.

## `mail.thread`

Use for chatter, followers, message posting, and field tracking.

```python
from odoo import fields, models


class BusinessTrip(models.Model):
    _name = "business.trip"
    _inherit = ["mail.thread"]

    name = fields.Char(tracking=True)
    partner_id = fields.Many2one("res.partner", tracking=True)
```

Form view:

```xml
<chatter open_attachments="True"/>
```

Usual follow-ups: `tracking=True` and occasional `_track_subtype(...)` for transition-specific subtypes.

## `mail.alias.mixin`

Use when a parent record owns an inbound email alias that creates child records.

Required overrides:

- `_get_alias_model_name(vals)`
- `_get_alias_values()`

## `mail.activity.mixin`

Use when records need scheduled follow-up work inside chatter.

```python
class BusinessTrip(models.Model):
    _name = "business.trip"
    _inherit = ["mail.thread", "mail.activity.mixin"]
```

This enables activity widgets and scheduling without custom tables.

## Source-backed rule of thumb

For chatter, aliasing, tracking, or activities, prefer the mixin before custom tables, mail routes, or controllers.
