---
name: core-module-structure-and-data
description:
  Manifest fields, ordered XML/CSV loading, and the practical meaning of `record`,
  `function`, `delete`, and `noupdate` when maintaining Odoo backend modules.
---

# Module Structure and Data Files

Most breakage here is not "how do I write XML?" but "why did this load in the wrong
order, stop updating, or become impossible to inherit cleanly?"

## Manifest fields that matter most

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

- `depends`: module load graph. Always list what you extend or rely on.
- `data`: files loaded on install and update.
- `demo`: demo-only data.
- `auto_install`: useful for glue/integration modules.
- `external_dependencies`: declare Python or binary requirements.
- hooks: use only when ORM and declarative data cannot reasonably do the job.

## Data files load sequentially

Later operations can refer to earlier results, not the reverse. Stable external IDs are
mandatory for anything you will update, inherit, or reference later.

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
- Plain operations outside `noupdate` reload during install and update.

Use `noupdate` for records administrators are expected to customize. Do not place
structural records there unless you want to own their upgrades forever.

## XML operations that are still worth remembering

- `record`: create or update by external ID
- `field ref="module.xmlid"`: explicit relational links
- `field search="[(...)]"`: resolve relation by domain
- `field eval="..."`: last resort, not the default
- `function`: use only when declarative records are not enough
- `delete`: remove by XML ID or by search domain

Example:

```xml
<function model="res.partner" name="send_inscription_notice"
    eval="[[ref('partner_1'), ref('partner_2')]]"/>
```

Reserve `function` for setup flows that genuinely belong in Python. If static records
are enough, keep them declarative.

## Shortcut tags worth knowing

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

1. `security/ir.model.access.csv`
2. security XML such as groups and rules
3. base data your views/actions depend on
4. views, menus, actions
5. reports
6. demo data

That ordering avoids unresolved references and missing security around menus or actions.
