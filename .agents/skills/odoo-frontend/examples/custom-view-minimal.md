# Minimal Custom View — Paste-Ready

The smallest runnable new view type in Odoo 19. Designed to be mechanically adaptable to any display goal.

## Target

A view type `my_view` that displays records as a grid of cards. `res.partner` as an example model.

## File tree

```
my_module/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   └── ir_ui_view.py
├── static/src/
│   ├── my_view.js
│   ├── my_view_arch_parser.js
│   ├── my_view_controller.js
│   ├── my_view_controller.xml
│   ├── my_view_renderer.js
│   └── my_view_renderer.xml
└── views/
    └── my_view_views.xml
```

---

## `__manifest__.py`
```python
{
    'name': "My View",
    'version': '19.0.1.0.0',
    'depends': ['web', 'contacts'],
    'data': ['views/my_view_views.xml'],
    'assets': {
        'web.assets_backend': [
            'my_module/static/src/**/*',
        ],
    },
    'license': 'LGPL-3',
}
```

## `__init__.py`
```python
from . import models
```

## `models/__init__.py`
```python
from . import ir_ui_view
```

## `models/ir_ui_view.py`
```python
from odoo import fields, models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[('my_view', "My View")])

    def _get_view_info(self):
        return {
            'my_view': {'icon': 'fa fa-th-large'},
        } | super()._get_view_info()
```

## `views/my_view_views.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_partner_my_view" model="ir.ui.view">
        <field name="name">res.partner.my_view</field>
        <field name="model">res.partner</field>
        <field name="type">my_view</field>
        <field name="arch" type="xml">
            <my_view title_field="name" subtitle_field="email"/>
        </field>
    </record>

    <record id="res_partner_action_my_view" model="ir.actions.act_window">
        <field name="name">Partners (Custom View)</field>
        <field name="res_model">res.partner</field>
        <field name="view_mode">my_view,list,form</field>
    </record>

    <menuitem id="menu_my_view_root"
              name="My View Demo"
              action="res_partner_action_my_view"
              sequence="100"/>
</odoo>
```

## `static/src/my_view_arch_parser.js`
```js
export class MyViewArchParser {
    parse(xmlDoc) {
        return {
            titleField: xmlDoc.getAttribute("title_field"),
            subtitleField: xmlDoc.getAttribute("subtitle_field"),
        };
    }
}
```

## `static/src/my_view_controller.js`
```js
import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Layout } from "@web/search/layout";
import { KeepLast } from "@web/core/utils/concurrency";

export class MyViewController extends Component {
    static template = "my_module.MyViewController";
    static components = { Layout };
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.keepLast = new KeepLast();
        this.state = useState({ records: [] });

        onWillStart(() => this._load(this.props.domain));
        onWillUpdateProps((next) => this._load(next.domain));
    }

    async _load(domain) {
        const { titleField, subtitleField } = this.props.archInfo;
        const fields = {};
        if (titleField) fields[titleField] = {};
        if (subtitleField) fields[subtitleField] = {};
        const { records } = await this.keepLast.add(
            this.orm.webSearchRead(this.props.resModel, domain, {
                specification: fields,
            })
        );
        this.state.records = records;
    }

    onRecordClick(record) {
        this.action.switchView("form", { resId: record.id });
    }
}
```

## `static/src/my_view_controller.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="my_module.MyViewController">
        <Layout className="'o_my_view'" display="props.display">
            <!-- onRecordClick.bind="onRecordClick": OWL's `.bind` modifier passes
                 a function bound to `this` (the controller) so the renderer can
                 invoke it without losing context. Without `.bind`, `this` inside
                 onRecordClick would be the renderer's component instance. -->
            <t t-component="props.Renderer"
               records="state.records"
               archInfo="props.archInfo"
               onRecordClick.bind="onRecordClick"/>
        </Layout>
    </t>
</templates>
```

## `static/src/my_view_renderer.js`
```js
import { Component } from "@odoo/owl";

export class MyViewRenderer extends Component {
    static template = "my_module.MyViewRenderer";
    static props = {
        records: Array,
        archInfo: Object,
        onRecordClick: Function,
    };
}
```

## `static/src/my_view_renderer.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="my_module.MyViewRenderer">
        <div class="o_my_view_grid d-flex flex-wrap gap-2 p-3">
            <div t-foreach="props.records" t-as="record" t-key="record.id"
                 class="o_my_view_card p-3 border rounded"
                 t-on-click="() => props.onRecordClick(record)">
                <strong t-esc="record[props.archInfo.titleField]"/>
                <div t-if="props.archInfo.subtitleField" class="text-muted">
                    <t t-esc="record[props.archInfo.subtitleField]"/>
                </div>
            </div>
        </div>
    </t>
</templates>
```

## `static/src/my_view.js`
```js
import { registry } from "@web/core/registry";
import { MyViewArchParser } from "./my_view_arch_parser";
import { MyViewController } from "./my_view_controller";
import { MyViewRenderer } from "./my_view_renderer";

export const myView = {
    type: "my_view",
    display_name: "My View",
    icon: "fa fa-th-large",
    multiRecord: true,
    Controller: MyViewController,
    ArchParser: MyViewArchParser,
    Renderer: MyViewRenderer,
    props: (genericProps, view) => {
        const archInfo = new view.ArchParser().parse(
            genericProps.arch, genericProps.relatedModels, genericProps.resModel
        );
        return {
            ...genericProps,
            archInfo,
            Renderer: view.Renderer,
        };
    },
};

registry.category("views").add("my_view", myView);
```

---

## How to run

1. Drop this module in your addons path, install with `-i my_module`.
2. Open the app menu "My View Demo".
3. Cards show partners with their name and email. Click to open the form.

## What's verified vs what's chosen

All of the framework bits are verified against Odoo 19.0 source:
- `ir.ui.view.type` `selection_add` and `_get_view_info` override: same pattern as `web_hierarchy`.
- `registry.category("views").add(...)`: `addons/web/static/src/views/view.js` line 91.
- `Layout` component usage: `addons/web/static/src/search/layout.js`.
- `webSearchRead`: `addons/web/static/src/core/orm_service.js` (orm service). Invoked with `specification` and optional `context`.
- `KeepLast`: `addons/web/static/src/core/utils/concurrency.js`.
- Dynamic component rendering (`t-component="props.Renderer"`): standard OWL pattern used by every built-in view.

The specific arch (title_field/subtitle_field), CSS, and layout are design choices — change freely.

## Next steps

- For a richer version with image fields, tooltips, pagination, upload: see `examples/gallery-view-full.md`.
- To extend instead of creating new: see `references/view-inheritance.md` and `examples/view-inheritance.md`.
- To add server-side arch validation, either ship an RNG and register it with `@view_validation.validate(...)` or implement `_validate_tag_my_view` on `ir.ui.view`.
