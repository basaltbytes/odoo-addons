# Odoo 19 Arch XML

Use this for Odoo 19 arch attributes, modifiers, `options=`, buttons, groups, and removed XML patterns.

## Table of Contents

1. Root tags
2. Removed patterns
3. Modifiers
4. Context, domain, and options
5. Common widget options
6. Buttons
7. Groups and security
8. Form layout
9. Validation sources

## 1. Root Tags

Core `ir.ui.view.type` values in community 19.0:

```text
list, form, graph, pivot, calendar, kanban, search, qweb
```

Community addons add:

- `activity` from `mail`
- `hierarchy` from `web_hierarchy`

Enterprise-only tags such as `gantt`, `map`, `cohort`, and `grid` are out of scope here because the 19.0 enterprise source is private.

The arch root tag must match the view record's `type`. Use `<list>`, not the removed `<tree>` root.

## 2. Removed Patterns

Odoo 17+ removed `attrs=`, `states=`, and `<tree>`.

```xml
<!-- bad -->
<field name="discount" attrs="{'invisible': [('state','=','done')]}"/>
<button name="action_draft" states="posted,cancel"/>
<tree><field name="name"/></tree>

<!-- good -->
<field name="discount" invisible="state == 'done'"/>
<button name="action_draft" invisible="state not in ('posted', 'cancel')"/>
<list><field name="name"/></list>
```

When inheriting a view and combining an existing modifier, use `<attribute separator="and|or">`; see [view-inheritance](./view-inheritance.md).

## 3. Modifiers

Common modifier attrs:

- `invisible`
- `readonly`
- `required`
- `column_invisible` for list-column behavior

They use Odoo py.js expressions evaluated against the current record. In x2many subviews, `parent.` references the parent record.

```xml
<field name="price" invisible="state == 'draft' or not partner_id" readonly="locked"/>
<field name="partner_vat" required="country_id.vat_required"/>
<field name="amount" column_invisible="parent.state == 'draft'"/>
```

Important distinction:

- `invisible="True"` or `"1"` can be compiled away entirely.
- Other expressions are evaluated per render.
- `column_invisible` only makes sense for list-style columns and is combined with button `invisible` rules.

## 4. Context, Domain, and Options

`context` and `domain` are py.js expressions:

```xml
<field name="partner_id" context="{'default_country_id': country_id}"/>
<field name="line_id" domain="[('partner_id', '=', parent.partner_id)]"/>
```

`options=` parsing depends on the node:

| Node | Parser | Consequence |
| --- | --- | --- |
| `<field options="...">` | py.js | Single quotes and `True`/`False`/`None` are valid |
| `<widget options="...">` | py.js | Same rule as fields |
| `<button options="...">` | strict JSON | Use double quotes and `true`/`false` |

```xml
<field name="partner_id" options="{'no_open': True, 'no_create': False}"/>
<widget name="my_banner" options="{'mode': 'warning'}"/>
<button name="action_post" type="object" options='{"close": true}'/>
```

Do not call `JSON.parse` inside field or view widget `extractProps`; Odoo already parsed `options`.

## 5. Common Widget Options

High-frequency built-in options:

| Widget | Options |
| --- | --- |
| `many2one` | `no_open`, `no_create`, `no_quick_create`, `no_create_edit`, `search_threshold`, `placeholder_field`, `can_scan_barcode`, `create_name_field` |
| `many2many_tags` | `no_create`, `no_quick_create`, `no_create_edit`, `create`, `color_field`, `search_threshold`, `placeholder_field` |
| `many2many_tags_avatar` | tag options plus `no_edit_color`, `edit_tags` |
| `image` | `reload`, `zoom`, `convert_to_webp`, `zoom_delay`, `accepted_file_extensions`, `size`, `preview_image` |
| `boolean_toggle` | `autosave` |

`image` uses `alt` as an XML attribute, not an option.

## 6. Buttons

Common button attrs include `name`, `type`, `string`, `icon`, `class`, `context`, `confirm`, `confirm-label`, `cancel-label`, `special`, `groups`, `invisible`, `readonly`, and `column_invisible`.

Button `type`:

- `object`: `name` is a Python method on the record.
- `action`: `name` is an action id or `%(xmlid)d`.
- `<a type="url">` is rewritten into a button by the compiler.

Only a subset of attrs becomes click params: `name`, `type`, `args`, `block-ui`, `context`, `close`, confirmation labels, `special`, `effect`, `help`, `debounce`, and `noSaveDialog`. Other attrs stay as element attrs.

```xml
<button name="action_confirm"
        type="object"
        string="Confirm"
        class="btn-primary"
        confirm="Confirm this order?"
        groups="sales_team.group_sale_salesman"
        invisible="state != 'draft'"/>
```

## 7. Groups and Security

`groups` is a comma-separated list of XML IDs; prefix with `!` to negate:

```xml
<field name="internal_ref" groups="base.group_system,!base.group_portal"/>
```

Nodes failing `groups` are stripped server-side before the arch reaches the client. Use `groups` for access-driven visibility; `invisible` is only client-side UI logic.

## 8. Form Layout

Common form elements:

| Element | Use |
| --- | --- |
| `<sheet>` | Main form body; no sheet gives `o_form_nosheet` styling |
| `<header>` | Statusbar/buttons area |
| `<footer>` | Dialog/wizard buttons |
| `<group>` | Two-column layout; nested groups become columns |
| `<notebook>` / `<page>` | Tabs; `page` must be a direct child of `notebook` |
| `<separator>` | Horizontal separator with optional label |

```xml
<form>
    <header>
        <button name="action_confirm" type="object" string="Confirm"
                invisible="state != 'draft'" class="btn-primary"/>
        <field name="state" widget="statusbar" statusbar_visible="draft,done"/>
    </header>
    <sheet>
        <group>
            <field name="partner_id" options="{'no_open': True}"/>
            <field name="amount" readonly="state == 'done'"/>
        </group>
    </sheet>
</form>
```

## 9. Validation Sources

- `odoo/addons/base/models/ir_ui_view.py`: root type validation, removed `attrs`/`states`, form-specific validators.
- `odoo/addons/base/rng/common.rng`: shared attrs such as buttons and groups.
- `odoo/addons/base/rng/*_view.rng`: community RNG schemas for activity, calendar, graph, list, pivot, search.
- `addons/web/static/src/views/view_compiler.js`: modifier compilation and `<a type="url">`.
- `addons/web/static/src/views/fields/field.js`: field parsing, field options, `column_invisible`.
- `addons/web/static/src/views/widgets/widget.js`: view widget parsing.
- `addons/web/static/src/views/utils.js`: button parsing and click params.
- `addons/web/static/src/views/form/form_compiler.js`: form layout compilation.
