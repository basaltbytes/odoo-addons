# View Inheritance Patterns

Paste-ready XPath inheritance snippets for Odoo 19.

## Table of contents

1. Adding a field
2. Removing a field (via groups, not deletion)
3. Replacing a field with a custom arrangement
4. Combining `invisible` expressions with `or` / `and`
5. Adding classes to existing nodes
6. Adding a ribbon (widget) to an existing form
7. Changing a button's behavior conditionally
8. Moving nodes during a `replace`
9. Adding a searchpanel to an existing search view
10. Turning an existing view into a `js_class` variant

---

## 1. Adding a field

### Short form (preferred when unambiguous)

```xml
<record id="view_partner_form_extra" model="ir.ui.view">
    <field name="name">res.partner.form.extra</field>
    <field name="model">res.partner</field>
    <field name="inherit_id" ref="base.view_partner_form"/>
    <field name="arch" type="xml">
        <field name="email" position="after">
            <field name="custom_identifier"/>
        </field>
    </field>
</record>
```

### Long form with explicit XPath

```xml
<xpath expr="//field[@name='email']" position="after">
    <field name="custom_identifier"/>
</xpath>
```

## 2. Removing a field (prefer `groups=` over deletion)

For security-sensitive fields, use `groups=` to strip server-side:

```xml
<field name="internal_ref" position="attributes">
    <attribute name="groups">base.group_system</attribute>
</field>
```

Alternatively (not recommended for security):
```xml
<xpath expr="//field[@name='internal_ref']" position="replace"/>
```

## 3. Replacing a field with a custom arrangement

```xml
<field name="amount_total" position="replace">
    <div class="d-flex justify-content-between align-items-center">
        <span>Grand total:</span>
        <field name="amount_total" widget="monetary" nolabel="1"/>
    </div>
</field>
```

## 4. Combining `invisible` expressions

For attributes in `PYTHON_ATTRIBUTES = {readonly, required, invisible, column_invisible, t-if, t-elif}`, use `separator="and"` or `"or"` to combine expressions instead of concatenating strings.

> **Trade-off:** `separator=` *preserves* the parent's expression and your inheritance composes whatever the parent ships today. If you write the full combined expression yourself with `<attribute name="invisible">…</attribute>`, you freeze a snapshot — when the upstream module later tightens its condition, your view won't pick up the change. Use `separator=` whenever you're extending an Odoo-stdlib view; use the full overwrite only when you genuinely want to replace the parent's logic.

### Combine with OR

Parent: `invisible="state == 'done'"`.
```xml
<xpath expr="//field[@name='discount']" position="attributes">
    <attribute name="invisible" add="not partner_id" separator="or"/>
</xpath>
```
Result: `invisible="(state == 'done') or (not partner_id)"`.

### Combine with AND

Parent: `required="is_company"`.
```xml
<xpath expr="//field[@name='vat']" position="attributes">
    <attribute name="required" add="country_id.code in ('FR','BE')" separator="and"/>
</xpath>
```
Result: `required="(is_company) and (country_id.code in ('FR','BE'))"`.

## 5. Adding classes

```xml
<xpath expr="//form" position="attributes">
    <attribute name="class" add="o_my_custom" separator=" "/>
</xpath>

<!-- or remove -->
<xpath expr="//form" position="attributes">
    <attribute name="class" remove="o_form_nosheet" separator=" "/>
</xpath>
```

## 6. Adding a `web_ribbon` to an existing form

```xml
<record id="sale_order_form_archived_ribbon" model="ir.ui.view">
    <field name="name">sale.order.form.archived.ribbon</field>
    <field name="model">sale.order</field>
    <field name="inherit_id" ref="sale.view_order_form"/>
    <field name="arch" type="xml">
        <sheet position="before">
            <widget name="web_ribbon"
                    title="Archived"
                    bg_color="text-bg-danger"
                    invisible="active"/>
        </sheet>
    </field>
</record>
```

> **Why `<sheet position="before">` and not `inside`?** The ribbon CSS positions itself absolutely against the nearest non-static ancestor. Placing it just *before* the sheet means it pins to the form's top-right corner (the visual norm for ribbons). Putting it `inside` the sheet works too, but the ribbon then sits inside the scrollable form body and overlaps content as you scroll.

## 7. Changing a button conditionally

```xml
<xpath expr="//button[@name='action_confirm']" position="attributes">
    <attribute name="invisible">state != 'draft'</attribute>
    <attribute name="groups">sales_team.group_sale_manager</attribute>
</xpath>
```

Or add a `confirm` dialog:
```xml
<xpath expr="//button[@name='action_confirm']" position="attributes">
    <attribute name="confirm">Are you sure you want to confirm this order?</attribute>
</xpath>
```

## 8. Moving nodes during a `replace`

```xml
<xpath expr="//group[@name='main']" position="replace">
    <group name="main" col="4">
        <group>
            <!-- keep the existing partner_id field alive inside the new outer group -->
            <xpath expr="//field[@name='partner_id']" position="move"/>
        </group>
        <group>
            <xpath expr="//field[@name='date']" position="move"/>
            <field name="new_field"/>
        </group>
    </group>
</xpath>
```

Without `move`, `partner_id` and `date` would be deleted with their parent `<group>`.

## 9. Adding a searchpanel to an existing search view

```xml
<record id="sale_order_search_panel" model="ir.ui.view">
    <field name="name">sale.order.search.panel</field>
    <field name="model">sale.order</field>
    <field name="inherit_id" ref="sale.view_sales_order_filter"/>
    <field name="arch" type="xml">
        <search position="inside">
            <searchpanel>
                <field name="team_id" icon="fa-users" enable_counters="1"/>
                <field name="state" select="multi" icon="fa-filter"/>
            </searchpanel>
        </search>
    </field>
</record>
```

## 10. Turning an existing view into a `js_class` variant

```xml
<record id="crm_lead_kanban_js_class" model="ir.ui.view">
    <field name="name">crm.lead.kanban.mine</field>
    <field name="model">crm.lead</field>
    <field name="inherit_id" ref="crm.crm_case_kanban_view_leads"/>
    <field name="arch" type="xml">
        <xpath expr="//kanban" position="attributes">
            <attribute name="js_class">my_lead_kanban</attribute>
        </xpath>
    </field>
</record>
```

Then register `my_lead_kanban` in JS:
```js
import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";

registry.category("views").add("my_lead_kanban", {
    ...kanbanView,
    Renderer: MyLeadKanbanRenderer,
});
```

## Short-form vs XPath

When both unambiguously resolve to the same node, prefer the short form — it's shorter and more readable. Use full `<xpath expr="...">` when:

- The target is deeply nested and XPath predicates make the intent clearer.
- You need `position="move"` on multiple non-adjacent nodes.
- You need to match by something other than `name=` (e.g. `hasclass(...)`, `@string='...'`).

## Debugging

If your inheritance silently fails:

- Check that `inherit_id` references the right view (typo-free XML ID, module prefix).
- Make sure the parent view is loaded first (add to `depends` if in another module).
- If the XPath doesn't match, Odoo logs a warning. Check the server log when reloading views.
- For mode issues: if you need a different `xml_id` for the result, use `mode="primary"` and give the inheriting view its own identity.
