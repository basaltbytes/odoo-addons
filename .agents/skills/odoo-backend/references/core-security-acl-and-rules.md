---
name: core-security-acl-and-rules
description: ACLs, record rules, field-level access, `sudo`, and the security pitfalls that routinely leak data or break access control in Odoo backend code.
---

# Security, ACL, and Rules

Use this for backend security failure modes: where Odoo grants access, where it filters records, and where code bypasses those protections.

## Access Layers

ACLs are additive model-level CRUD. Record rules filter rows: global rules intersect, group rules unify, and global/group sets intersect. Field `groups=` removes fields from views, `fields_get()`, and explicit read/write access outside the group.

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_business_trip_user,business.trip user,model_business_trip,base.group_user,1,1,1,0
access_business_trip_manager,business.trip manager,model_business_trip,my_module.group_trip_manager,1,1,1,1
```

```xml
<record id="business_trip_rule_owner" model="ir.rule">
    <field name="name">Business Trip: owner only</field>
    <field name="model_id" ref="model_business_trip"/>
    <field name="domain_force">[('user_id', '=', user.id)]</field>
    <field name="groups" eval="[(4, ref('base.group_user'))]"/>
</record>
```

```python
secret_amount = fields.Float(groups="my_module.group_trip_manager")
```

## Public Methods Are Attack Surface

Any public model method is callable via RPC with caller-chosen parameters and recordsets.

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

## Bypass Rules

- `sudo()` bypasses ACLs and record rules; keep it narrow and do not leak sudoed recordsets.
- Use `with_user(...)` when the goal is "act as this user", not "bypass everything".
- Raw SQL skips ACLs, record rules, ORM cache behavior, and company safeguards; use ORM first.
- Never interpolate SQL by hand. Use `odoo.tools.SQL(...)`.

```python
from odoo.tools import SQL

self.env.cr.execute(
    SQL("SELECT id FROM business_trip WHERE user_id IN %s"),
    [tuple(ids)],
)
```

## Data Input Rules

- Build domains with `Domain(...)`; do not blindly append caller-provided domain fragments.
- Prefer typed parsers over `safe_eval`: `json.loads`, `ast.literal_eval`, `int`, `float`.
- Use `record[field_name]` for dynamic field names, not `getattr(record, field_name)` or `setattr(...)`.
- Escape before mixing data into HTML; treat `Markup` as code and plain strings as text.

```python
from odoo.fields import Domain

user_domain = Domain(self.filter_domain)
secure_domain = user_domain & Domain("user_id", "=", self.env.uid)
records = self.search(secure_domain)
```

```python
from markupsafe import Markup, escape

message = Markup("<strong>%s</strong>") % escape(record.name)
```
