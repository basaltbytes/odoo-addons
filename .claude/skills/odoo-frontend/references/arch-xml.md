# Odoo 19 Arch XML — Attributes, Options, Modifiers

Everything you can (and can't) put in an arch, verified against `odoo/odoo@19.0`.

> **Verification status:** root tags and modifiers are verified against `odoo/odoo@19.0`
> open-source. Widget options in §6 are verified against
> `addons/web/static/src/views/fields/`. Enterprise-only root tags exist, but this skill
> does not carry a separate enterprise view reference.
>
> **Related references:**
>
> - [view-registration.md](./view-registration.md) — adding a new root tag
>   (`ir.ui.view.type`)
> - [view-inheritance.md](./view-inheritance.md) — `<attribute>` and
>   `separator="and|or"` for combining modifiers
> - [field-widgets.md](./field-widgets.md) — `supportedOptions` declarations on custom
>   widgets
> - [../SKILL.md](../SKILL.md#red-flags--arch-mistakes-that-hard-fail-or-silently-break)
>   — Red Flags table summarises §2 below

## Table of contents

1. Root tags and which ones are core vs addon-provided
2. Removed patterns (Odoo 17+)
3. Modifier attributes (`invisible`, `readonly`, `required`, `column_invisible`)
4. `context` and `domain` attributes
5. `options="..."` parsing — py.js on `<field>`, JSON on `<button>`
6. Common `options` for standard widgets
7. Buttons — `type`, `confirm`, click params
8. `groups` attribute (access control in arch)
9. Form layout elements (`<sheet>`, `<header>`, `<footer>`, `<group>`, `<notebook>`,
   `<page>`, `<separator>`)
10. RelaxNG schemas shipped in community

---

## 1. Root tags

### Core 19.0 `ir.ui.view.type` Selection (verified)

`odoo/addons/base/models/ir_ui_view.py` lines 149–156:

```python
type = fields.Selection([('list', 'List'),
                         ('form', 'Form'),
                         ('graph', 'Graph'),
                         ('pivot', 'Pivot'),
                         ('calendar', 'Calendar'),
                         ('kanban', 'Kanban'),
                         ('search', 'Search'),
                         ('qweb', 'QWeb')], string='View Type')
```

The root tag of the arch must match the `type` field:

```python
if node.tag != view_type:
    ... "The root node of a %(view_type)s view should be a <%(view_type)s>, not a <%(tag)s>"
```

Source: `odoo/addons/base/models/ir_ui_view.py` lines 1781–1799.

### Types added by community addons

- **`<activity>`** — added by `mail` module (`_inherit = 'ir.ui.view'` +
  `selection_add=[('activity', 'Activity')]`). Community, verified via
  `addons/mail/static/src/views/web/activity/`.
- **`<hierarchy>`** — added by `web_hierarchy` module. Community, verified.

### Types added by enterprise addons

- **`<gantt>`**, **`<map>`**, **`<cohort>`**, **`<grid>`** — enterprise-only. UNVERIFIED
  FOR 19.0 from public sources (`github.com/odoo/enterprise` is private).

### `<tree>` is gone

`<list>` is the only valid list root in Odoo 17+. `<tree>` is not accepted. Verified in
`list_view.rng` and `ir_ui_view.py` line 1551
(`'invisible' if root.tag != 'list' else 'column_invisible'`).

## 2. Removed patterns (Odoo 17+)

> SKILL.md's "Red Flags" table summarises this section. Read on for source citations and
> migration patterns.

These still raise `ValidationError` in 19.0. Source:
`odoo/addons/base/models/ir_ui_view.py` lines 492–498:

```python
if combined_arch.xpath('//*[@attrs]') or combined_arch.xpath('//*[@states]'):
    ... "Since 17.0, the "attrs" and "states" attributes are no longer used."
```

To combine an inherited `invisible` expression with a new condition, use
`separator="and"` or `"or"` on the `<attribute>` child — see
[view-inheritance.md §4](./view-inheritance.md#4-python-attribute-combiners).

### `attrs=` — removed

```xml
<!-- BAD (pre-17): raises ValidationError in 19 -->
<field name="discount" attrs="{'invisible': [('state','=','done')]}"/>

<!-- GOOD -->
<field name="discount" invisible="state == 'done'"/>
```

### `states=` — removed

```xml
<!-- BAD -->
<button name="action_draft" states="posted,cancel"/>

<!-- GOOD -->
<button name="action_draft" invisible="state not in ('posted','cancel')"/>
```

### `<tree>` — removed

```xml
<!-- BAD -->
<tree><field name="name"/></tree>

<!-- GOOD -->
<list><field name="name"/></list>
```

## 3. Modifier attributes

Valid on any node: `invisible`, `readonly`, `required`, `column_invisible` (list-only
semantics).

They accept **py.js expressions** — Python-like expressions evaluated by
`@web/core/py_js/py`. The identifiers in the expression are the sibling field names of
the current record (plus `parent.` prefix in x2many subviews).

### How they compile

Source: `addons/web/static/src/views/view_compiler.js` lines 226–242 (function
`applyInvisible`):

```javascript
if (invisible === "True" || invisible === "1") {
  return; // node is dropped entirely from the compiled template
}
const isVisibleExpr = `!__comp__.evaluateBooleanExpr(${JSON.stringify(invisible)},${recordExpr}.evalContextWithVirtualIds)`;
```

Two important consequences:

1. Literal `"True"` or `"1"` causes the node to be **dropped at compile time**. Useful
   for fully removing a field that should never be shown in this context.
2. All other expressions are evaluated per-render against
   `record.evalContextWithVirtualIds`. Expressions may reference any field in the loaded
   record.

### `column_invisible` vs `invisible`

`column_invisible` only makes sense in **list views**. Source:
`addons/web/static/src/views/fields/field.js` lines 249–258:

```javascript
for (const attr of ["invisible", "column_invisible", "readonly", "required"]) {
  fieldInfo[attr] = node.getAttribute(attr);
  if (fieldInfo[attr] === "True") {
    if (attr === "column_invisible") {
      fieldInfo.invisible = "True";
    }
  }
}
```

For buttons, `column_invisible` OR-combines with `invisible`
(`addons/web/static/src/views/utils.js` line 238):

```javascript
invisible: combineModifiers(
    node.getAttribute("column_invisible"),
    node.getAttribute("invisible"),
    "OR"
),
```

### Examples

```xml
<field name="price" invisible="state == 'draft' or not partner_id" readonly="locked"/>
<field name="partner_vat" required="country_id.vat_required"/>
<field name="amount" column_invisible="parent.state == 'draft'"/>
```

Don't write `context`-like tuples; those are for domains, not modifiers.

## 4. `context` and `domain` attributes

Both are py.js expressions that produce, respectively, a dict and a list of triples.

### `context="{...}"`

Evaluated via `evaluateExpr` against the record's eval context. Typical usage:

```xml
<field name="partner_id" context="{'default_country_id': country_id}"/>
<button name="action_open" type="object" context="{'active_test': False}"/>
```

### `domain="[...]"`

Evaluated via `evaluateExpr` and then passed through the `Domain` class. `parent.`
prefix is supported in x2many subviews. Source:
`addons/web/static/src/views/fields/field.js` line 441:

```javascript
return new Domain(evaluateExpr(fieldInfo.domain, evalContext)).toList();
```

Example:

```xml
<field name="partner_id" domain="[('company_id', '=', company_id)]"/>
<field name="line_id" domain="[('partner_id', '=', parent.partner_id)]"/>
```

## 5. `options="..."` parsing

### On `<field>` — py.js

Source: `addons/web/static/src/views/fields/field.js` lines 269–271:

```javascript
} else if (name === "options") {
    fieldInfo.options = evaluateExpr(value);
}
```

Consequence: Python literals are accepted (single quotes, `True`/`False`/`None`):

```xml
<field name="partner_id" options="{'no_open': True, 'no_create': False}"/>
<field name="image_1920" widget="image" options="{'size': [0, 90], 'preview_image': 'image_128'}"/>
<field name="tag_ids" widget="many2many_tags" options="{'color_field': 'color'}"/>
```

### On `<button>` — strict JSON

Source: `addons/web/static/src/views/utils.js` line 235:

```javascript
options: JSON.parse(node.getAttribute("options") || "{}"),
```

Consequence: double quotes required, JSON booleans only:

```xml
<button name="action_post" type="object" string="Post"
        options='{"close": true}'/>
```

### On `<widget>` — py.js

Source: `addons/web/static/src/views/widgets/widget.js` lines 65–89:

```javascript
if (name === "options") {
  widgetInfo.options = evaluateExpr(value);
}
```

## 6. Common `options` for standard widgets

Verified from `addons/web/static/src/views/fields/*` in 19.0:

### `many2one`

Source: `addons/web/static/src/views/fields/many2one/many2one_field.js` lines 9–53
(`supportedOptions`):

- `no_open` (bool)
- `no_create` (bool)
- `no_quick_create` (bool)
- `no_create_edit` (bool)
- `search_threshold` (number)
- `placeholder_field` (char field name)
- runtime-honoured: `can_scan_barcode`, `create_name_field`

### `many2many_tags`

Source: `addons/web/static/src/views/fields/many2many_tags/many2many_tags_field.js`
lines 197–251:

- `no_create` (bool)
- `no_quick_create` (bool)
- `no_create_edit` (bool)
- `create` (bool)
- `color_field` (string — name of an integer field on the related model)
- `search_threshold` (number)
- `placeholder_field` (field)

### `many2many_tags_avatar`

Extends `many2many_tags` with:

- `no_edit_color` (bool)
- `edit_tags` (bool)

### `image`

Source: `addons/web/static/src/views/fields/image/image_field.js` lines 242–286:

- `reload` (bool, default `True`)
- `zoom` (bool)
- `convert_to_webp` (bool)
- `zoom_delay` (number, ms)
- `accepted_file_extensions` (string)
- `size` (`[0, 90] | [0, 180] | [0, 270]`)
- `preview_image` (name of another binary field to use as preview)
- `alt` is an XML attribute (not an option):
  `<field name="image" widget="image" alt="..."/>`

### `boolean_toggle`

Source: `addons/web/static/src/views/fields/boolean_toggle/boolean_toggle_field.js`
lines 19–40:

- `autosave` (bool, default `True`)

## 7. Buttons

### RelaxNG attributes (common.rng)

Source: `odoo/addons/base/rng/common.rng` lines 314–358:

```
name, icon, string, type, special, align, colspan, target, readonly,
context, confirm, confirm-label, cancel-label, help, class,
default_focus, tabindex, title, aria-label, aria-pressed, display,
data-hotkey, width, disabled, invisible, column_invisible, groups
```

### Click params (runtime)

Only these button attributes flow to the click handler. Others go to `attrs`. Source:
`addons/web/static/src/views/utils.js` lines 19–39:

```javascript
export const BUTTON_CLICK_PARAMS = [
  "name",
  "type",
  "args",
  "block-ui",
  "context",
  "close",
  "cancel-label",
  "confirm",
  "confirm-title",
  "confirm-label",
  "special",
  "effect",
  "help",
  "debounce",
  "noSaveDialog",
];
```

### `type` values

- `type="object"` — `name` is a Python method name on the record.
- `type="action"` — `name` is an action XML ID (format `%(xmlid)d` or numeric id).
- Special case: `<a type="url">` is rewritten to a `<button>` at compile time. Source:
  `view_compiler.js` lines 311–314.

### Example

```xml
<button name="action_confirm"
        type="object"
        class="btn-primary"
        string="Confirm"
        icon="fa-check"
        confirm="Are you sure you want to confirm this order?"
        confirm-label="Yes, confirm"
        cancel-label="Not yet"
        groups="sales_team.group_sale_salesman"
        invisible="state != 'draft'"/>

<button name="%(my_module.action_open_wizard)d"
        type="action"
        string="Open wizard"/>
```

## 8. `groups` attribute

Source: `odoo/addons/base/rng/common.rng` lines 43–47 (pattern `access_rights`):

```xml
<rng:define name="access_rights">
    <rng:optional>
        <rng:attribute name="groups"/>
    </rng:optional>
</rng:define>
```

Comma-separated list of group XML IDs. A `!` prefix negates:

```xml
<field name="internal_ref" groups="base.group_system,!base.group_portal"/>
```

Semantics (server-side): nodes failing the predicate are **stripped from the arch**
before it reaches the client. The user doesn't just "not see" the field — it isn't in
the arch at all. This is the recommended approach for secret/internal fields;
`invisible=` only hides client-side.

`groups` is independent from view inheritance — don't conflate the two.

## 9. Form layout elements

All compiled by `addons/web/static/src/views/form/form_compiler.js`. Registration: lines
54–62:

```javascript
{ selector: "footer", fn: this.compileFooter },
{ selector: "group", fn: this.compileGroup },
{ selector: "header", fn: this.compileHeader },
{ selector: "notebook", fn: this.compileNotebook },
{ selector: "separator", fn: this.compileSeparator },
{ selector: "sheet", fn: this.compileSheet },
```

### `<sheet>`

Wraps the main form body. Without a `<sheet>`, the form gets class `o_form_nosheet`.
Source: `form_compiler.js` lines 216–241.

### `<header>`

Compiled to `o_form_statusbar` (hosts status-bar buttons and the statusbar field
widget). Source: `form_compiler.js` lines 441–476.

### `<footer>`

Wizard/dialog footer (where `Save`/`Cancel` go in modals). Source: `form_compiler.js`
lines 265–283.

### `<group>`

Two-column grid. If `<group>` contains a `<group>` child, it becomes an "outer group"
(the inner groups become columns). Source: `form_compiler.js` line 290.

### `<notebook>` + `<page>`

Compiled to an OWL `Notebook` component with `t-set-slot` children. **Server-side
validation requires `<page>` to be a direct child of `<notebook>`** (`ir_ui_view.py`
lines 2086–2093).

### `<separator>`

Horizontal rule with optional `string="..."`.

### Example

```xml
<form>
    <header>
        <button name="action_confirm" type="object" string="Confirm"
                invisible="state != 'draft'" class="btn-primary"/>
        <field name="state" widget="statusbar" statusbar_visible="draft,done"/>
    </header>
    <sheet>
        <div class="oe_title">
            <h1><field name="name" placeholder="Name"/></h1>
        </div>
        <group>
            <group>
                <field name="partner_id"
                       options="{'no_open': True, 'no_quick_create': True}"
                       required="state == 'draft'"/>
                <field name="amount"/>
            </group>
            <group>
                <field name="date"/>
                <field name="active" widget="boolean_toggle" options="{'autosave': False}"/>
            </group>
        </group>
        <notebook>
            <page string="Lines" name="lines">
                <field name="line_ids">
                    <list editable="bottom">
                        <field name="product_id"/>
                        <field name="qty" column_invisible="parent.state == 'draft'"/>
                    </list>
                </field>
            </page>
        </notebook>
    </sheet>
    <footer>
        <button string="Save" special="save" class="btn-primary"/>
    </footer>
</form>
```

## 10. RelaxNG schemas shipped in community 19.0

Source: `odoo/addons/base/rng/`. Only these:

- `activity_view.rng`
- `calendar_view.rng`
- `common.rng` (shared)
- `graph_view.rng`
- `list_view.rng`
- `pivot_view.rng`
- `search_view.rng`

There is no RNG for `<form>`, `<kanban>`, `<qweb>`, `<hierarchy>`. Those are validated
by Python methods in `ir_ui_view.py` (e.g. `_validate_tag_hierarchy` in
`web_hierarchy`).

Writing your own view type? You can optionally ship an RNG and register it with
`@view_validation.validate('my_view')`. Or do arch validation in `_validate_tag_my_view`
like `web_hierarchy` does.
