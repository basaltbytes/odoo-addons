# Odoo 19 View Inheritance (XPath)

How `<record model="ir.ui.view">` inheritance works, verified against `odoo/odoo@19.0`.

> **Related references:**
>
> - [arch-xml.md](./arch-xml.md) — modifiers (`invisible`/`readonly`) syntax that
>   combiners in §4 manipulate
> - [view-registration.md §4](./view-registration.md#4-customizing-an-existing-view-with-js_class)
>   — `js_class` (the lighter-weight alternative when you only need to swap a
>   Renderer/Controller)
> - [../examples/view-inheritance.md](../examples/view-inheritance.md) — paste-ready
>   snippets for the most common XPath patterns

## Table of contents

1. Inheritance modes (`primary` vs `extension`)
2. XPath positions and the short form
3. Mutating attributes — `<attribute>` with `add`, `remove`, `separator`
4. Python-attribute combiners — `separator="and"` / `"or"`
5. `move` — relocate nodes inside a `replace`
6. Practical examples

---

## 1. Inheritance modes

Source: `odoo/addons/base/models/ir_ui_view.py` lines 177–188:

```python
mode = fields.Selection([('primary', "Base view"), ('extension', "Extension View")],
                        string="View inheritance mode", default='primary', required=True,
                        help="""...
* if extension (default), if this view is requested the closest primary view
is looked up (via inherit_id), then all views inheriting from it with this
view's model are applied
* if primary, the closest primary view is fully resolved (even if it uses a
different model than this one), then this view's inheritance specs
(<xpath/>) are applied, and the result is used as if it were this view's
actual arch.""")
```

Note: the ORM-level default of the `mode` field is `'primary'`. **However**, the runtime
treats `inherit_id` set + `mode` unset as an extension in practice —
`_combine_inherited_views` resolves the parent and applies your specs to it, which is
the extension behaviour. The convention in XML is therefore: set `mode="extension"` (or
omit it and rely on inherit_id semantics) for extensions; set `mode="primary"`
explicitly when you want a separately-addressable view that uses the parent only as a
base. **If in doubt, write `mode="extension"` explicitly** — the convention is clearer
and avoids surprises.

### When to use each

- **`mode="extension"`** (default when `inherit_id` is set) — you want your XPath specs
  applied to every invocation of the parent. Typical case: adding a field to an existing
  form.
- **`mode="primary"`** — you want a separate, addressable view that shares the parent's
  structure as a starting point but exists on its own (different `xml_id`, different
  model permitted). Typical case: creating a specialized form that reuses most of the
  base arch.

## 2. XPath positions

Source: `odoo/tools/template_inheritance.py` lines 159–333.

Valid values of `position`:

| Position     | What it does                                                        |
| ------------ | ------------------------------------------------------------------- |
| `before`     | Insert this spec's content before the matched node                  |
| `after`      | Insert this spec's content after the matched node                   |
| `inside`     | (default) Append this spec's content inside the matched node        |
| `replace`    | Replace the matched node with this spec's content                   |
| `attributes` | Modify attributes of the matched node via `<attribute>` children    |
| `move`       | (child-only, inside a `replace`) relocate an existing node — see §5 |

Any other value raises `"Invalid position attribute"` (line 333).

### Long form

```xml
<xpath expr="//field[@name='partner_id']" position="after">
    <field name="partner_ref"/>
</xpath>
```

### Short form

Use any tag as the spec and set a `name`. The engine walks the parent via `locate_node`.
Source: `odoo/addons/base/models/ir_ui_view.py` line 864.

```xml
<!-- short form, equivalent to <xpath expr="//field[@name='partner_id']" position="after"> -->
<field name="partner_id" position="after">
    <field name="partner_ref"/>
</field>

<!-- short form for attribute mutation -->
<field name="partner_id" position="attributes">
    <attribute name="required">1</attribute>
</field>
```

The short form is preferred whenever it unambiguously resolves the target.

## 3. `<xpath position="attributes">` with `<attribute>`

Source: `template_inheritance.py` lines 235–311.

Inside `<xpath position="attributes">` (or short-form
`<tag ... position="attributes">`), each `<attribute>` child mutates one attribute.

`<attribute>` accepted children on itself:

| Attribute on `<attribute>` | Meaning                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `name` (required)          | Which attribute on the target node to mutate                                                                        |
| `add`                      | String to add to the existing value (set-addition)                                                                  |
| `remove`                   | String to remove from the existing value (set-removal)                                                              |
| `separator`                | Delimiter used by `add`/`remove` — default `,`; can be any string; for Python attributes use `and` or `or` (see §4) |

If neither `add` nor `remove` is set, the text content of `<attribute>` replaces the
attribute value entirely. Empty text removes the attribute.

### Examples

**Replace entirely:**

```xml
<xpath expr="//field[@name='state']" position="attributes">
    <attribute name="required">1</attribute>
</xpath>
```

**Add to a class list:**

```xml
<xpath expr="//form" position="attributes">
    <attribute name="class" add="o_my_custom" separator=" "/>
</xpath>
```

**Remove a class:**

```xml
<xpath expr="//form" position="attributes">
    <attribute name="class" remove="o_form_nosheet" separator=" "/>
</xpath>
```

**Remove an attribute entirely** (empty text):

```xml
<xpath expr="//field[@name='state']" position="attributes">
    <attribute name="placeholder"></attribute>
</xpath>
```

## 4. Python-attribute combiners

Source: `template_inheritance.py` line 20:

```python
PYTHON_ATTRIBUTES = {'readonly', 'required', 'invisible', 'column_invisible', 't-if', 't-elif'}
```

For these attributes, `separator="and"` or `separator="or"` combines the existing value
with the new one using logical operators instead of string concatenation:

```xml
<!-- The existing invisible expression is ORed with ours -->
<xpath expr="//field[@name='discount']" position="attributes">
    <attribute name="invisible" add="not partner_id" separator="or"/>
</xpath>
```

If the parent had `invisible="state == 'done'"`, after this inheritance the field's
`invisible` becomes `"(state == 'done') or (not partner_id)"`.

**Why this matters:** you can't just write `separator=" "` for a python attribute — the
result `"state == 'done' not partner_id"` would be a syntax error. Use `and`/`or`.

## 5. `move`

Only valid as a child of a `replace` block. Source: `template_inheritance.py` lines
136–144 and 205–212.

Use `move` to keep existing nodes alive while replacing their surroundings:

```xml
<xpath expr="//group[@name='main']" position="replace">
    <group name="main" class="new">
        <!-- keep the existing <field name="partner_id"/> alive inside the new wrapper -->
        <xpath expr="//field[@name='partner_id']" position="move"/>
        <field name="new_field"/>
    </group>
</xpath>
```

Without `move`, the field would have been removed along with its parent in the
`replace`.

## 6. Practical examples

### Add a field after another

```xml
<record id="my_view_inherited" model="ir.ui.view">
    <field name="name">res.partner.form.extra</field>
    <field name="model">res.partner</field>
    <field name="inherit_id" ref="base.view_partner_form"/>
    <field name="arch" type="xml">
        <field name="email" position="after">
            <field name="custom_notes"/>
        </field>
    </field>
</record>
```

### Wrap existing content in a new group

```xml
<xpath expr="//group[@name='main']" position="replace">
    <group name="main" col="4">
        <group>
            <xpath expr="//field[@name='partner_id']" position="move"/>
            <xpath expr="//field[@name='date']" position="move"/>
        </group>
        <group>
            <field name="new_custom_field"/>
        </group>
    </group>
</xpath>
```

### Remove a field conditionally (use groups, not XPath-remove)

Prefer `groups="..."` over removing a field — `groups` strips the node server-side based
on the user's groups:

```xml
<field name="price_list" position="attributes">
    <attribute name="groups">sales_team.group_sale_manager</attribute>
</field>
```

### Add a new kanban card section

```xml
<record id="my_kanban_inherited" model="ir.ui.view">
    <field name="name">my.model.kanban.inherited</field>
    <field name="model">my.model</field>
    <field name="inherit_id" ref="my_module.my_model_view_kanban"/>
    <field name="arch" type="xml">
        <xpath expr="//t[@t-name='card']//div[hasclass('o_kanban_record_body')]" position="inside">
            <div class="o_my_extra">
                <field name="extra_field"/>
            </div>
        </xpath>
    </field>
</record>
```

### Combine `invisible` with `or`

```xml
<xpath expr="//field[@name='internal_notes']" position="attributes">
    <attribute name="invisible" add="user_has_no_access" separator="or"/>
</xpath>
```

### Converting an existing view to a `js_class` variant

```xml
<record id="my_view_with_jsclass" model="ir.ui.view">
    <field name="name">contact.kanban.mine</field>
    <field name="model">res.partner</field>
    <field name="inherit_id" ref="base.res_partner_kanban_view"/>
    <field name="arch" type="xml">
        <xpath expr="//kanban" position="attributes">
            <attribute name="js_class">my_partner_kanban</attribute>
        </xpath>
    </field>
</record>
```

And in JS:

```js
import {registry} from "@web/core/registry";
import {kanbanView} from "@web/views/kanban/kanban_view";
import {MyPartnerKanbanRenderer} from "./my_partner_kanban_renderer";

registry.category("views").add("my_partner_kanban", {
  ...kanbanView,
  Renderer: MyPartnerKanbanRenderer,
});
```
