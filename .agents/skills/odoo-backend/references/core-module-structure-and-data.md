---
name: core-module-structure-and-data
description: Manifest fields, ordered XML/CSV loading, and the practical meaning of `record`, `function`, `delete`, and `noupdate` when maintaining Odoo backend modules.
---

# Module Structure and Data Files

Use this for load order, `noupdate`, external IDs, and data operations.

## Manifest Fields

```python
{
    "depends": ["base", "mail"],
    "data": [
        "security/ir.model.access.csv",
        "security/my_rules.xml",
        "views/my_views.xml",
    ],
    "demo": ["demo/demo.xml"],
    "auto_install": False,
    "external_dependencies": {"python": ["pandas"]},
    "post_init_hook": "post_init_hook",
}
```

Rules: `depends` lists modules you extend/rely on; `data` loads on install/update; `demo` is demo-only; `auto_install` is for glue modules; `external_dependencies` declares Python/binary requirements; hooks are last resort.

## Data files load sequentially

Later operations can refer to earlier records, not the reverse. Stable external IDs are mandatory for anything you will update, inherit, or reference.

## `noupdate` changes upgrade behavior

```xml
<odoo>
    <data noupdate="1">
        <record id="my_rule" model="ir.rule">
            <field name="name">My Rule</field>
        </record>
    </data>
</odoo>
```

- `noupdate="1"` means install once, then preserve manual edits on module updates.
- Use it for admin-customizable records, not structural records you expect to upgrade.
- Plain operations outside `noupdate` reload on install and update.

## XML Operations

Use `record` to create/update by external ID, `field ref="module.xmlid"` for explicit links, `field search="[(...)]"` for domain resolution, `field eval="..."` only when needed, `function` for Python setup flows, and `delete` by XML ID or search domain.

Example:

```xml
<function model="res.partner" name="send_inscription_notice"
    eval="[[ref('partner_1'), ref('partner_2')]]"/>
```

Reserve `function` for setup flows that genuinely belong in Python. If static records are enough, keep them declarative.

## Shortcut Tags

- `menuitem`: shorter `ir.ui.menu` definition
- `template`: shorter `ir.ui.view` definition for QWeb templates
- `asset`: shorter `ir.asset` definition

## CSV is for repetitive flat records

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_business_trip_user,business.trip user,model_business_trip,base.group_user,1,1,1,0
```

ACLs are the canonical case.

## Practical loading order

`security/ir.model.access.csv` -> security XML -> base data -> views/menus/actions -> reports -> demo data.
