# Registering a View in Odoo 19

How to register a new view type end-to-end, or extend an existing one via `js_class`.
Every claim is sourced.

> **Prerequisite:** read [view-architecture.md](./view-architecture.md) for the
> descriptor + 5-piece mental model first.
>
> **Related references:**
>
> - [view-architecture.md](./view-architecture.md) — descriptor keys, runtime
>   resolution, standard props
> - [arch-xml.md](./arch-xml.md) — arch root tags, modifiers, options
> - [../examples/custom-view-minimal.md](../examples/custom-view-minimal.md) —
>   paste-ready minimum
> - [../examples/gallery-view-full.md](../examples/gallery-view-full.md) — full worked
>   example with Model + Renderer + pagination

## Table of contents

1. End-to-end: adding a brand-new view type
2. The minimum Python to extend `ir.ui.view.type` and
   `ir.actions.act_window.view.view_mode`
3. The minimum JS to register a descriptor
4. Customizing an existing view with `js_class`
5. `view_mode` on `ir.actions.act_window` — the resolution path
6. The server-side validator for custom views (`_validate_tag_xxx`)
7. Working community example: `web_hierarchy`

---

## 1. End-to-end: adding a brand-new view type

To add a new view type `my_view`, four places need attention (plus one optional, see
§1.5):

1. **`ir.ui.view.type`** — add `'my_view'` to the Selection. Without this, the server
   refuses to save an `<ir.ui.view>` record with `type="my_view"`.
2. **`ir.ui.view._get_view_info`** — add
   `'my_view': {'icon': '...', 'multi_record': True}`. Without this entry,
   `session.view_info["my_view"]` is undefined and the JS registry validator rejects the
   type.
3. **JS descriptor** — register the view in `registry.category("views")`.
4. **arch record** — a `<record model="ir.ui.view">` with `type="my_view"` and a
   `<my_view>...</my_view>` arch.

### 1.5 Optional fifth place

- `ir.actions.act_window.view.view_mode` — only if you declare view records on
  `<field name="view_ids">` of an action (because that child model has a Selection too).
  If you just use `<field name="view_mode">list,form,my_view</field>`, no selection
  extension is needed here (the field on the parent action is a free-form `Char`).

## 2. The minimum Python

### 2.1 Extend `ir.ui.view.type`

Source for `ir.ui.view.type`: `odoo/addons/base/models/ir_ui_view.py` lines 149–156
(Odoo 19.0):

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

Extend in your module:

```python
# my_module/models/ir_ui_view.py
from odoo import fields, models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(
        selection_add=[('my_view', "My View")],
    )

    def _get_view_info(self):
        # Merge: super() first so our entry is additive, not overriding
        return {
            'my_view': {
                'icon': 'fa fa-th-large',
                # 'multi_record': True,  # default — set False for form-like views
            },
        } | super()._get_view_info()
```

The pattern `return {...} | super()._get_view_info()` is taken verbatim from
`addons/web_hierarchy/models/ir_ui_view.py` (verified Odoo 19.0):

```python
def _get_view_info(self):
    return {'hierarchy': {'icon': 'fa fa-share-alt fa-rotate-90'}} | super()._get_view_info()
```

Source: https://github.com/odoo/odoo/blob/19.0/addons/web_hierarchy/models/ir_ui_view.py

### 2.2 Extend `ir.actions.act_window.view.view_mode` (only if needed)

Source: `odoo/addons/base/models/ir_actions.py` lines 400–407 (Odoo 19.0):

```python
VIEW_TYPES = [
    ('list', 'List'),
    ('form', 'Form'),
    ('graph', 'Graph'),
    ('pivot', 'Pivot'),
    ('calendar', 'Calendar'),
    ('kanban', 'Kanban'),
]
```

Extend if you declare view children on an action:

```python
# my_module/models/ir_action.py
from odoo import fields, models


class ActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    view_mode = fields.Selection(
        selection_add=[('my_view', "My View")],
        ondelete={'my_view': 'cascade'},
    )
```

Verbatim pattern from `awesome_gallery/models/ir_action.py` (Odoo 19.0 tutorials
branch):

```python
from odoo import fields, models

class ActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    view_mode = fields.Selection(selection_add=[
        ('gallery', "Awesome Gallery")
    ],  ondelete={'gallery': 'cascade'})
```

Source:
https://raw.githubusercontent.com/odoo/tutorials/19.0/awesome_gallery/models/ir_action.py

The top-level `view_mode` field of `ir.actions.act_window` itself is a **free-form
`Char`**:

```python
view_mode = fields.Char(required=True, default='list,form',
    help="Comma-separated list of allowed view modes, such as 'form', 'list', 'calendar', etc. (Default: list,form)")
```

Source: `odoo/addons/base/models/ir_actions.py` (19.0). Its `_check_view_mode`
constraint only validates "no duplicates, no spaces", not membership.

## 3. The minimum JS

File layout:

```
my_module/
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── ir_action.py          # only if needed
│   └── ir_ui_view.py
├── static/src/
│   ├── my_view.js            # the descriptor
│   ├── my_view_controller.js
│   ├── my_view_controller.xml
│   ├── my_view_renderer.js
│   ├── my_view_renderer.xml
│   └── my_view_arch_parser.js
└── views/
    └── my_view_views.xml
```

### `my_view.js`

```js
import {registry} from "@web/core/registry";
import {RelationalModel} from "@web/model/relational_model/relational_model";
import {MyViewArchParser} from "./my_view_arch_parser";
import {MyViewController} from "./my_view_controller";
import {MyViewRenderer} from "./my_view_renderer";

export const myView = {
  type: "my_view",
  Controller: MyViewController,
  Renderer: MyViewRenderer,
  ArchParser: MyViewArchParser,
  Model: RelationalModel,
  // optional, match list/form/kanban pattern:
  buttonTemplate: "my_module.MyViewButtons",

  props: (genericProps, view) => {
    const {ArchParser} = view;
    const {arch, relatedModels, resModel} = genericProps;
    const archInfo = new ArchParser().parse(arch, relatedModels, resModel);
    return {
      ...genericProps,
      Model: view.Model,
      Renderer: view.Renderer,
      archInfo,
    };
  },
};

registry.category("views").add("my_view", myView);
```

### `__manifest__.py` assets entry

```python
'assets': {
    'web.assets_backend': [
        'my_module/static/src/**/*',
    ],
},
```

### `views/my_view_views.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_partner_view_my_view" model="ir.ui.view">
        <field name="name">res.partner.my_view</field>
        <field name="model">res.partner</field>
        <field name="type">my_view</field>
        <field name="arch" type="xml">
            <my_view>
                <!-- any arch your ArchParser expects -->
                <field name="name"/>
            </my_view>
        </field>
    </record>

    <record id="res_partner_action" model="ir.actions.act_window">
        <field name="name">Contacts (custom)</field>
        <field name="res_model">res.partner</field>
        <field name="view_mode">list,form,my_view</field>
    </record>
</odoo>
```

See [../examples/custom-view-minimal.md](../examples/custom-view-minimal.md) for the
smallest runnable version of all four files.

## 4. Customizing an existing view with `js_class`

Use when you want to keep the standard arch tag (`<kanban>`, `<list>`, `<form>`, etc.)
but replace/augment the Controller, Renderer, Model, or ArchParser.

**Step 1 — set `js_class` on the arch root:**

```xml
<record id="crm_lead_kanban_inherited" model="ir.ui.view">
    <field name="name">crm.lead.kanban.awesome</field>
    <field name="model">crm.lead</field>
    <field name="inherit_id" ref="crm.crm_case_kanban_view_leads"/>
    <field name="arch" type="xml">
        <xpath expr="//kanban" position="attributes">
            <attribute name="js_class">awesome_kanban</attribute>
        </xpath>
    </field>
</record>
```

Verbatim from `awesome_kanban/views/views.xml` (Odoo 19.0 tutorials branch):
https://raw.githubusercontent.com/odoo/tutorials/19.0/awesome_kanban/views/views.xml

**Step 2 — register an extended descriptor under that key:**

```js
import {registry} from "@web/core/registry";
import {kanbanView} from "@web/views/kanban/kanban_view";

class MyKanbanRenderer extends kanbanView.Renderer {
  // your overrides
}

registry.category("views").add("awesome_kanban", {
  ...kanbanView,
  Renderer: MyKanbanRenderer,
});
```

No Python is required for `js_class` customization — you're not adding a view type,
you're adding a JS variant of an existing type. The resolution order in `view.js` line
344 is `arch@js_class` → `props.jsClass` → `type`. A missing key triggers a lazy-bundle
load before it fails.

Source: `addons/web/static/src/views/view.js` line 344–354.

## 5. `view_mode` resolution path

Given `<field name="view_mode">list,form,my_view</field>`:

1. Server serializes the action to the client: the `view_mode` string reaches the client
   as-is.
2. The client's action manager initializes the view switcher and opens the first
   available mode.
3. When switching to `my_view`, `View.loadView` runs:
   - validates `"my_view" in session.view_info` — needs `_get_view_info` to have been
     overridden server-side.
   - looks up `registry.category("views").get("my_view")`.
   - calls `descr.props(genericProps, descr, env.config)` and mounts `descr.Controller`.

## 6. Server-side validation of arch (`_validate_tag_xxx`)

The base `ir.ui.view._validate_view` dispatches to `_validate_tag_<type>` methods when
present. It enforces root-tag consistency:

```python
if node.tag != view_type:
    ... "The root node of a %(view_type)s view should be a <%(view_type)s>, not a <%(tag)s>"
```

Source: `odoo/addons/base/models/ir_ui_view.py` lines 1781–1799 (19.0).

You can implement `_validate_tag_my_view` on your `_inherit = 'ir.ui.view'` to walk the
arch and raise `ValidationError` on invalid structure. The reference implementation is
`web_hierarchy` (`addons/web_hierarchy/models/ir_ui_view.py`):

```python
HIERARCHY_VALID_ATTRIBUTES = {
    '__validate__', 'class', 'js_class', 'string',
    'create', 'edit', 'delete',
    'parent_field', 'child_field', 'icon', 'draggable', 'default_order'
}

class IrUiView(models.Model):
    _inherit = 'ir.ui.view'
    type = fields.Selection(selection_add=[('hierarchy', "Hierarchy")])

    def _is_qweb_based_view(self, view_type):
        return super()._is_qweb_based_view(view_type) or view_type == "hierarchy"

    def _validate_tag_hierarchy(self, node, name_manager, node_info):
        if not node_info['validate']:
            return
        for attr in node.attrib:
            if attr not in HIERARCHY_VALID_ATTRIBUTES:
                self._raise_view_error(
                    _("Invalid attribute '%(attr)s' on <hierarchy>", attr=attr), node)
        templates_seen = 0
        for child in node:
            if child.tag == 'templates':
                templates_seen += 1
            elif child.tag != 'field':
                self._raise_view_error(
                    _("Hierarchy children must be <field> or <templates>, got <%(tag)s>", tag=child.tag), child)
        if templates_seen > 1:
            self._raise_view_error(_("Only one <templates> allowed in <hierarchy>"), node)
```

`_is_qweb_based_view` is overridden when your arch uses `<t>` directives, so server-side
XML validation treats them correctly.

## 7. Working community example — `web_hierarchy`

All the pieces in one module in the Odoo 19 community source:

- Python: extends `ir.ui.view.type`, overrides `_get_view_info`, overrides
  `_is_qweb_based_view`, implements `_validate_tag_hierarchy`.
- JS: `static/src/hierarchy_view.js` registers the descriptor;
  `hierarchy_arch_parser.js`, `hierarchy_controller.js`, `hierarchy_renderer.js`,
  `hierarchy_model.js`, `hierarchy_compiler.js` implement the view.
- SCSS/templates in `static/src/`.
- Manifest `depends: ['web']`, license LGPL-3.

URL: https://github.com/odoo/odoo/tree/19.0/addons/web_hierarchy

This is the cleanest community-source reference for a brand-new view type in 19.0. Study
it before writing your own.
