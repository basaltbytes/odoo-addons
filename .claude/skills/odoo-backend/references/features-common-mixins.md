---
name: features-common-mixins
description:
  "The common backend mixins worth reusing before inventing custom plumbing: chatter,
  aliases, and activities."
---

# Common Mixins

Only keep the mixins that routinely replace a lot of custom backend plumbing. The
broader feature catalog is not worth loading into context unless the task is
specifically about it.

## `mail.thread`

Use it for chatter, followers, message posting, and field tracking.

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

Usual follow-ups are `tracking=True` on fields and occasional `_track_subtype(...)`
overrides when status transitions need a custom subtype.

## `mail.alias.mixin`

Use it when a parent record should own an inbound email alias that creates child
records.

Required overrides:

- `_get_alias_model_name(vals)`
- `_get_alias_values()`

## `mail.activity.mixin`

Use it when records need scheduled follow-up work inside chatter.

```python
class BusinessTrip(models.Model):
    _name = "business.trip"
    _inherit = ["mail.thread", "mail.activity.mixin"]
```

This enables activity widgets and scheduling flows without custom tables.

## Source-backed rule of thumb

If the behavior is chatter, aliasing, tracking, or activities, prefer the shipped mixin
before inventing tables, mail routes, or controllers.
