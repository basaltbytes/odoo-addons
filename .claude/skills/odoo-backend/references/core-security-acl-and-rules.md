---
name: core-security-acl-and-rules
description:
  ACLs, record rules, field-level access, `sudo`, and the security pitfalls that
  routinely leak data or break access control in Odoo backend code.
---

# Security, ACL, and Rules

Keep this file for backend-specific failure modes. The important part is not what ACLs
are, but where Odoo code quietly bypasses them.

## ACLs grant model-level CRUD

ACLs are additive. A user's effective model access is the union of all ACLs granted
through their groups.

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_business_trip_user,business.trip user,model_business_trip,base.group_user,1,1,1,0
access_business_trip_manager,business.trip manager,model_business_trip,my_module.group_trip_manager,1,1,1,1
```

## Record rules filter rows

```xml
<record id="business_trip_rule_owner" model="ir.rule">
    <field name="name">Business Trip: owner only</field>
    <field name="model_id" ref="model_business_trip"/>
    <field name="domain_force">[('user_id', '=', user.id)]</field>
    <field name="groups" eval="[(4, ref('base.group_user'))]"/>
</record>
```

Composition rules that matter:

- global rules intersect
- group rules unify
- global and group rule sets intersect

This is why multiple global rules are dangerous: they can accidentally intersect down to
zero rows.

## Field groups strip field visibility

```python
secret_amount = fields.Float(groups="my_module.group_trip_manager")
```

If the user is outside those groups, the field disappears from views, `fields_get()`,
and explicit read/write access.

## Public methods are part of the attack surface

Any public model method is callable via RPC with caller-chosen parameters and
recordsets.

```python
from odoo import api, models
from odoo.exceptions import AccessError


class BusinessTrip(models.Model):
    _name = "business.trip"

    def action_confirm(self):
        self.ensure_one()
        if not self.env.user.has_group("my_module.group_trip_manager"):
            raise AccessError("Only trip managers can confirm trips.")
        return self._confirm_trip()

    @api.private
    def _confirm_trip(self):
        self.write({"state": "confirmed"})
```

## `sudo()` is a scalpel, not a default

- `sudo()` bypasses ACLs and record rules.
- Keep the privileged block as small as possible.
- Do not hand a sudoed recordset back to normal flows unless that is truly intended.
- If the goal is "behave as another user", prefer `with_user(...)` over blanket
  `sudo()`.

## Raw SQL bypasses the whole security stack

Cursor-level SQL skips access rights, record rules, and ORM cache behavior. If the ORM
can express the query, use the ORM first.

## Never interpolate SQL by hand

Bad:

```python
self.env.cr.execute(
    "SELECT id FROM business_trip WHERE user_id IN (%s)" % ",".join(map(str, ids))
)
```

Better:

```python
from odoo.tools import SQL

self.env.cr.execute(
    SQL("SELECT id FROM business_trip WHERE user_id IN %s"),
    [tuple(ids)],
)
```

## Build domains safely

Do not append caller-provided domain fragments blindly. Compose with `Domain(...)` and
add your security predicates explicitly.

```python
from odoo.fields import Domain

user_domain = Domain(self.filter_domain)
secure_domain = user_domain & Domain("user_id", "=", self.env.uid)
records = self.search(secure_domain)
```

## `safe_eval` is still privileged execution

Prefer typed parsers:

- `json.loads(...)`
- `ast.literal_eval(...)`
- `int(...)`, `float(...)`

## Escape before mixing data into HTML

```python
from markupsafe import Markup, escape

message = Markup("<strong>%s</strong>") % escape(record.name)
```

- never trust `t-raw` with evolving content
- keep HTML structure separate from data
- treat `Markup` objects as code, plain strings as text

## Dynamic field access: use `record[field_name]`

Avoid `getattr(record, field_name)` or `setattr(...)` for user-provided field names.
