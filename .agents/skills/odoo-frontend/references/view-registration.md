# Registering an Odoo 19 View

Use this when adding a brand-new view type or creating a `js_class` variant of an existing view. For runnable scaffolding, load [custom-view-minimal](../examples/custom-view-minimal.md); for a larger example, load [gallery-view-full](../examples/gallery-view-full.md).

## Table of Contents

1. New view type checklist
2. Minimal Python
3. Minimal JS descriptor
4. `js_class` customization
5. Action `view_mode`
6. Server-side validation
7. Source anchors

## 1. New View Type Checklist

A new root tag such as `<my_view>` needs:

1. `ir.ui.view.type`: add `('my_view', "My View")`.
2. `ir.ui.view._get_view_info()`: add icon metadata so `session.view_info.my_view` exists.
3. JS descriptor: register in `registry.category("views")`.
4. View record: `<field name="type">my_view</field>` and `<my_view>...</my_view>` arch.
5. Optional `ir.actions.act_window.view.view_mode`: only needed when declaring child records in an action's `view_ids`.

If the XML root remains `list`, `form`, `kanban`, etc. and only JS behavior changes, use `js_class` instead of a new view type.

## 2. Minimal Python

```python
from odoo import fields, models


class IrUiView(models.Model):
    _inherit = "ir.ui.view"

    type = fields.Selection(selection_add=[("my_view", "My View")])

    def _get_view_info(self):
        return {
            "my_view": {"icon": "fa fa-th-large"},
        } | super()._get_view_info()
```

Only extend `ir.actions.act_window.view.view_mode` when you create action child view records:

```python
class ActWindowView(models.Model):
    _inherit = "ir.actions.act_window.view"

    view_mode = fields.Selection(
        selection_add=[("my_view", "My View")],
        ondelete={"my_view": "cascade"},
    )
```

The top-level `ir.actions.act_window.view_mode` is a comma-separated `Char`, so `view_mode="list,form,my_view"` does not need that selection extension.

## 3. Minimal JS Descriptor

```js
import { registry } from "@web/core/registry";
import { RelationalModel } from "@web/model/relational_model/relational_model";
import { MyViewArchParser } from "./my_view_arch_parser";
import { MyViewController } from "./my_view_controller";
import { MyViewRenderer } from "./my_view_renderer";

export const myView = {
    type: "my_view",
    Controller: MyViewController,
    Renderer: MyViewRenderer,
    ArchParser: MyViewArchParser,
    Model: RelationalModel,
    props(genericProps, view) {
        const archInfo = new view.ArchParser().parse(
            genericProps.arch,
            genericProps.relatedModels,
            genericProps.resModel,
        );
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

Add all JS/XML/SCSS files to `web.assets_backend` in `__manifest__.py`.

## 4. `js_class` Customization

Use `js_class` to alter one view instance without adding a new server view type:

```xml
<xpath expr="//kanban" position="attributes">
    <attribute name="js_class">awesome_kanban</attribute>
</xpath>
```

```js
import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";

registry.category("views").add("awesome_kanban", {
    ...kanbanView,
    Renderer: MyKanbanRenderer,
});
```

Runtime lookup order is `arch@js_class`, then `props.jsClass`, then `type`. If the registry key is missing, Odoo tries the lazy asset bundle before failing.

## 5. Action `view_mode`

For a simple action:

```xml
<record id="res_partner_action_my_view" model="ir.actions.act_window">
    <field name="name">Partners</field>
    <field name="res_model">res.partner</field>
    <field name="view_mode">my_view,list,form</field>
</record>
```

When the client opens `my_view`, it validates `my_view` in `session.view_info`, gets the descriptor from `registry.category("views")`, calls descriptor `props`, and mounts the controller.

## 6. Server-Side Validation

The base validator enforces root-tag consistency. For custom arch constraints, implement `_validate_tag_my_view` on `ir.ui.view` or ship an RNG validator.

Use `web_hierarchy` as the community reference: it extends `ir.ui.view.type`, overrides `_get_view_info`, overrides `_is_qweb_based_view` because the arch uses `<t>` templates, and validates allowed attributes/children.

## 7. Source Anchors

- `odoo/addons/base/models/ir_ui_view.py`: `ir.ui.view.type`, root validation.
- `odoo/addons/base/models/ir_actions.py`: `ir.actions.act_window.view.view_mode`.
- `addons/web/models/ir_ui_view.py`: `_get_view_info` / `session.view_info`.
- `addons/web/static/src/views/view.js`: view registry validation and `js_class` lookup.
- `addons/web_hierarchy/`: clean community example of a new view type.
- `odoo/tutorials/19.0/awesome_gallery`: custom view tutorial pattern.
- `odoo/tutorials/19.0/awesome_kanban`: `js_class` tutorial pattern.
