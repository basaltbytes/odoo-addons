# Gallery View — Full Example

A more complete custom view with image display, tooltips, pagination, and click-to-form. Based on the 18.0 tutorial walkthrough but adapted to confirmed 19.0 APIs.

## File tree

```
awesome_gallery/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── ir_action.py
│   └── ir_ui_view.py
├── static/src/
│   ├── gallery_arch_parser.js
│   ├── gallery_controller.js
│   ├── gallery_controller.xml
│   ├── gallery_model.js
│   ├── gallery_renderer.js
│   ├── gallery_renderer.xml
│   ├── gallery_view.js
│   └── gallery_view.scss
└── views/
    └── views.xml
```

---

## Manifest

```python
{
    'name': "Gallery View",
    'version': '19.0.1.0.0',
    'depends': ['web', 'contacts'],
    'data': ['views/views.xml'],
    'assets': {
        'web.assets_backend': [
            'awesome_gallery/static/src/**/*',
        ],
    },
    'license': 'AGPL-3',
}
```

## Python: `models/ir_ui_view.py`

```python
from odoo import fields, models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[('gallery', "Gallery")])

    def _get_view_info(self):
        return {
            'gallery': {'icon': 'fa fa-th-large'},
        } | super()._get_view_info()
```

## Python: `models/ir_action.py`

```python
from odoo import fields, models


class ActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    view_mode = fields.Selection(
        selection_add=[('gallery', "Gallery")],
        ondelete={'gallery': 'cascade'},
    )
```

## XML: `views/views.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_partner_gallery" model="ir.ui.view">
        <field name="name">res.partner.gallery</field>
        <field name="model">res.partner</field>
        <field name="type">gallery</field>
        <field name="arch" type="xml">
            <gallery image_field="image_1920"
                     tooltip_field="name"
                     default_limit="20"/>
        </field>
    </record>

    <record id="contacts.action_contacts" model="ir.actions.act_window">
        <field name="view_mode">gallery,kanban,list,form,activity</field>
    </record>
</odoo>
```

## JS: `gallery_arch_parser.js`

```js
export class GalleryArchParser {
    parse(xmlDoc) {
        const imageField = xmlDoc.getAttribute("image_field");
        if (!imageField) {
            throw new Error(`Gallery view requires 'image_field' attribute`);
        }
        return {
            imageField,
            tooltipField: xmlDoc.getAttribute("tooltip_field") || null,
            defaultLimit: parseInt(xmlDoc.getAttribute("default_limit"), 10) || 40,
        };
    }
}
```

## JS: `gallery_model.js`

```js
import { KeepLast } from "@web/core/utils/concurrency";

export class GalleryModel {
    constructor(orm, resModel, archInfo) {
        this.orm = orm;
        this.resModel = resModel;
        this.archInfo = archInfo;
        this.keepLast = new KeepLast();
        this.records = [];
        this.offset = 0;
        this.limit = archInfo.defaultLimit;
        this.total = 0;
    }

    async load(domain) {
        const specification = { [this.archInfo.imageField]: {} };
        if (this.archInfo.tooltipField) {
            specification[this.archInfo.tooltipField] = {};
        }
        const result = await this.keepLast.add(
            this.orm.webSearchRead(this.resModel, domain, {
                specification,
                offset: this.offset,
                limit: this.limit,
                context: { bin_size: true },
            })
        );
        this.records = result.records;
        this.total = result.length;
        this.domain = domain;
    }

    async setPage({ offset, limit }) {
        this.offset = offset;
        this.limit = limit;
        await this.load(this.domain);
    }
}
```

## JS: `gallery_renderer.js`

```js
import { Component } from "@odoo/owl";
import { url as buildUrl } from "@web/core/utils/urls";

export class GalleryRenderer extends Component {
    static template = "awesome_gallery.GalleryRenderer";
    static props = {
        records: Array,
        resModel: String,
        archInfo: Object,
        onRecordClick: Function,
    };

    getImageUrl(record) {
        return buildUrl("/web/image", {
            model: this.props.resModel,
            id: record.id,
            field: this.props.archInfo.imageField,
            // bust the cache when the record is updated server-side
            ...(record.write_date ? { unique: record.write_date } : {}),
        });
    }

    getTooltip(record) {
        const field = this.props.archInfo.tooltipField;
        return field ? record[field] : null;
    }
}
```

## JS: `gallery_controller.js`

```js
import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Layout } from "@web/search/layout";
import { usePager } from "@web/search/pager_hook";

export class GalleryController extends Component {
    static template = "awesome_gallery.GalleryController";
    static components = { Layout };
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        const GalleryModel = this.props.Model;
        this.model = useState(new GalleryModel(
            this.orm, this.props.resModel, this.props.archInfo
        ));
        onWillStart(() => this.model.load(this.props.domain));
        onWillUpdateProps((next) => this.model.load(next.domain));

        // Registers a pager descriptor in the control-panel; Layout reads it.
        usePager(() => ({
            offset: this.model.offset,
            limit: this.model.limit,
            total: this.model.total,
            onUpdate: ({ offset, limit }) => this.model.setPage({ offset, limit }),
        }));
    }

    onRecordClick(record) {
        this.action.switchView("form", { resId: record.id });
    }
}
```

## XML template: `gallery_controller.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="awesome_gallery.GalleryController">
        <Layout className="'o_gallery_view'" display="props.display">
            <t t-component="props.Renderer"
               records="model.records"
               resModel="props.resModel"
               archInfo="props.archInfo"
               onRecordClick.bind="onRecordClick"/>
        </Layout>
    </t>
</templates>
```

## XML template: `gallery_renderer.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="awesome_gallery.GalleryRenderer">
        <div class="o_gallery_grid p-3">
            <div t-foreach="props.records" t-as="record" t-key="record.id"
                 class="o_gallery_card"
                 t-att-title="getTooltip(record)"
                 t-on-click="() => props.onRecordClick(record)">
                <img t-att-src="getImageUrl(record)" class="o_gallery_image" loading="lazy"/>
            </div>
            <div t-if="!props.records.length" class="text-muted text-center py-5">
                No records to display.
            </div>
        </div>
    </t>
</templates>
```

## JS: `gallery_view.js`

```js
import { registry } from "@web/core/registry";
import { GalleryArchParser } from "./gallery_arch_parser";
import { GalleryController } from "./gallery_controller";
import { GalleryModel } from "./gallery_model";
import { GalleryRenderer } from "./gallery_renderer";

export const galleryView = {
    type: "gallery",
    display_name: "Gallery",
    icon: "fa fa-th-large",
    multiRecord: true,
    Controller: GalleryController,
    ArchParser: GalleryArchParser,
    Model: GalleryModel,
    Renderer: GalleryRenderer,
    searchMenuTypes: ["filter", "groupBy", "favorite"],

    props: (genericProps, view) => {
        const archInfo = new view.ArchParser().parse(
            genericProps.arch, genericProps.relatedModels, genericProps.resModel
        );
        return {
            ...genericProps,
            archInfo,
            Model: view.Model,
            Renderer: view.Renderer,
        };
    },
};

registry.category("views").add("gallery", galleryView);
```

## SCSS: `gallery_view.scss`

```scss
.o_gallery_view {
    .o_gallery_grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
    }
    .o_gallery_card {
        cursor: pointer;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        aspect-ratio: 1 / 1;
        &:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
    }
    .o_gallery_image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
}
```

---

## Making it extensible

Other modules can override the Renderer via `js_class`:

### In the other module's XML
```xml
<record id="res_partner_gallery_extended" model="ir.ui.view">
    <field name="name">res.partner.gallery.extended</field>
    <field name="model">res.partner</field>
    <field name="inherit_id" ref="awesome_gallery.res_partner_gallery"/>
    <field name="arch" type="xml">
        <xpath expr="//gallery" position="attributes">
            <attribute name="js_class">awesome_gallery_extended</attribute>
        </xpath>
    </field>
</record>
```

### In the other module's JS
```js
import { registry } from "@web/core/registry";
import { galleryView } from "@awesome_gallery/gallery_view";
import { GalleryRenderer } from "@awesome_gallery/gallery_renderer";

class MyGalleryRenderer extends GalleryRenderer {
    static template = "my_module.MyGalleryRenderer";
}

registry.category("views").add("awesome_gallery_extended", {
    ...galleryView,
    Renderer: MyGalleryRenderer,
});
```

## Want a richer tooltip?

The renderer above uses the browser-native `title=` attribute, which works everywhere with zero wiring. For Odoo's styled tooltip, use `useTooltip` from `@web/core/tooltip/tooltip_hook` in the renderer's `setup()` and switch to `t-att-data-tooltip` plus `data-tooltip-template` (or `data-tooltip-info`).

## What's verified vs what's from the walkthrough

All framework bits are verified against Odoo 19.0 source — `registry.category("views")`, `Layout`, `useModel` pattern (manually done here without `useModel` because we use a non-RelationalModel), `webSearchRead` with `bin_size: true`, `KeepLast`, `/web/image`, `switchView`, `useService("action")`/`useService("orm")`, `js_class` resolution.

The specific arch attributes, the SCSS, the renderer structure, and the pagination wiring are design choices adaptable to your needs.
