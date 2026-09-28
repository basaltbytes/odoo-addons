# Odoo 19 View Inheritance

Use this for `<record model="ir.ui.view">` inheritance mechanics. For paste-ready snippets, load [view-inheritance examples](../examples/view-inheritance.md).

## Table of Contents

1. Modes
2. Positions
3. Attribute mutation
4. `move`
5. `js_class` variants
6. Debugging
7. Source anchors

## 1. Modes

| Mode | Use |
| --- | --- |
| `extension` | Patch the parent everywhere it is used. This is the normal `inherit_id` case. |
| `primary` | Create a separately addressable view that uses the parent as a base. |

When inheriting a standard view, be explicit if clarity matters:

```xml
<field name="inherit_id" ref="base.view_partner_form"/>
<field name="mode">extension</field>
```

Use `primary` only when the inheriting view should have its own identity, usually for a specialized view selected by an action.

## 2. Positions

Valid positions:

| Position | Effect |
| --- | --- |
| `before` | Insert before matched node |
| `after` | Insert after matched node |
| `inside` | Append inside matched node |
| `replace` | Replace matched node |
| `attributes` | Mutate attrs with `<attribute>` children |
| `move` | Relocate an existing node inside a `replace` |

Prefer short form when unambiguous:

```xml
<field name="email" position="after">
    <field name="custom_identifier"/>
</field>
```

Use full XPath for nested, class-based, or non-`name` matches:

```xml
<xpath expr="//t[@t-name='card']//div[hasclass('o_kanban_record_body')]" position="inside">
    <field name="extra_field"/>
</xpath>
```

## 3. Attribute Mutation

Replace an attribute by writing text:

```xml
<field name="state" position="attributes">
    <attribute name="required">1</attribute>
</field>
```

Add/remove tokenized values with a separator:

```xml
<xpath expr="//form" position="attributes">
    <attribute name="class" add="o_my_custom" separator=" "/>
    <attribute name="class" remove="o_form_nosheet" separator=" "/>
</xpath>
```

Combine Python-expression attrs with `separator="and"` or `"or"`:

```xml
<field name="discount" position="attributes">
    <attribute name="invisible" add="not partner_id" separator="or"/>
</field>
```

This preserves the parent expression and produces a combined expression such as `(state == 'done') or (not partner_id)`. Use it for `readonly`, `required`, `invisible`, `column_invisible`, `t-if`, and `t-elif`.

For security-sensitive visibility, prefer `groups=` over XPath removal:

```xml
<field name="internal_ref" position="attributes">
    <attribute name="groups">base.group_system</attribute>
</field>
```

## 4. `move`

`move` is only valid inside `replace`. Use it to keep existing nodes while replacing their container:

```xml
<xpath expr="//group[@name='main']" position="replace">
    <group name="main" col="4">
        <group>
            <xpath expr="//field[@name='partner_id']" position="move"/>
            <xpath expr="//field[@name='date']" position="move"/>
        </group>
        <group>
            <field name="new_field"/>
        </group>
    </group>
</xpath>
```

Without `move`, `partner_id` and `date` disappear with the replaced parent group.

## 5. `js_class` Variants

Use `js_class` when the root view type stays the same but JS behavior changes:

```xml
<xpath expr="//kanban" position="attributes">
    <attribute name="js_class">my_lead_kanban</attribute>
</xpath>
```

Then register a descriptor under that key:

```js
registry.category("views").add("my_lead_kanban", {
    ...kanbanView,
    Renderer: MyLeadKanbanRenderer,
});
```

## 6. Debugging

- Confirm `inherit_id` references the exact parent view XML ID.
- Ensure the parent module is in `depends` so load order is correct.
- Check server logs for XPath misses during view reload.
- Use short form for simple `name=` targets; use XPath when intent needs predicates.
- If you need a separate result view selected by an action, use `mode="primary"`.

## 7. Source Anchors

- `odoo/addons/base/models/ir_ui_view.py`: inheritance modes and short-form node locating.
- `odoo/tools/template_inheritance.py`: positions, `<attribute>`, Python-attribute combiners, `move`.
- `addons/web/static/src/views/view.js`: `js_class` resolution.
