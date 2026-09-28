# Custom View Widget — Paste-Ready

A custom `<widget name="banner">` that renders a color-coded banner on a form based on an arbitrary py.js condition.

## File tree

```
my_module/
├── __init__.py
├── __manifest__.py
└── static/src/
    ├── banner_widget.js
    ├── banner_widget.xml
    └── banner_widget.scss
```

## `__manifest__.py`
```python
{
    'name': "Banner Widget",
    'version': '19.0.1.0.0',
    'depends': ['web'],
    'assets': {
        'web.assets_backend': [
            'my_module/static/src/**/*',
        ],
    },
    'license': 'LGPL-3',
}
```

## `static/src/banner_widget.js`
```js
import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

export class BannerWidget extends Component {
    static template = "my_module.Banner";
    static props = {
        ...standardWidgetProps,
        text: { type: String },
        icon: { type: String, optional: true },
        level: { type: String, optional: true },  // "info" | "success" | "warning" | "danger"
    };
    static defaultProps = { level: "info", icon: "" };

    get cssClass() {
        const mapping = {
            info:    "alert-info",
            success: "alert-success",
            warning: "alert-warning",
            danger:  "alert-danger",
        };
        return mapping[this.props.level] || mapping.info;
    }
}

export const bannerWidget = {
    component: BannerWidget,
    extractProps: ({ attrs }) => ({
        // `attrs` values are always strings (XML attributes are not parsed).
        // For an `options=` attribute, the framework would have pre-parsed it
        // as py.js into `options` (separate key). We don't use options here.
        text: attrs.text || "",
        icon: attrs.icon || "",
        level: attrs.level || "info",
    }),
    supportedAttributes: [
        { label: _t("Text"),  name: "text",  type: "string" },
        { label: _t("Icon"),  name: "icon",  type: "string",
          help: _t("Font Awesome class, e.g. 'fa-info-circle'") },
        { label: _t("Level"), name: "level", type: "string",
          choices: [
              { label: _t("Info"),    value: "info"    },
              { label: _t("Success"), value: "success" },
              { label: _t("Warning"), value: "warning" },
              { label: _t("Danger"),  value: "danger"  },
          ] },
    ],
    additionalClasses: ["o_banner_widget"],
};

registry.category("view_widgets").add("banner", bannerWidget);
```

## `static/src/banner_widget.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="my_module.Banner">
        <div class="alert" t-att-class="cssClass" role="alert">
            <i t-if="props.icon" class="fa me-2" t-att-class="props.icon"/>
            <span t-esc="props.text"/>
        </div>
    </t>
</templates>
```

## `static/src/banner_widget.scss`
```scss
.o_banner_widget {
    display: block;
    margin-bottom: 1rem;
}
```

## Usage in arch

```xml
<form>
    <sheet>
        <widget name="banner"
                text="This order is on hold until payment is verified."
                icon="fa-clock-o"
                level="warning"
                invisible="payment_state != 'pending'"/>
        <group>
            <field name="name"/>
        </group>
    </sheet>
</form>
```

Notice how `invisible="payment_state != 'pending'"` uses the exact same py.js modifier syntax as a `<field>` — widgets are first-class citizens in the arch.

## What's verified

- `standardWidgetProps` — `addons/web/static/src/views/widgets/standard_widget_props.js`.
- `registry.category("view_widgets").add(...)` validator shape — `addons/web/static/src/views/widgets/widget.js` lines 27–49.
- `extractProps({attrs, options})` — same file lines 65–89 (attribute parsing) and 115–138 (props wiring).
- `supportedAttributes` entries with `choices` — same validator shape as in `field.js` lines 39–63.
- `additionalClasses` on view-widget descriptors — allowed in the validator.
- Modifier `invisible=` on `<widget>` nodes — works identically to `<field>`, compiled by `view_compiler.js`.

## Comparing to `web_ribbon`

`addons/web/static/src/views/widgets/ribbon/ribbon.js` is the canonical core example — this banner widget follows the same structure. The only real difference is that we accept a fourth attribute (`level`) and use it to switch Bootstrap alert classes.

## Common pitfalls

- **Don't use `JSON.parse`-style quotes for `options=` on widgets.** It's py.js. Use Python syntax.
- **Don't read `this.props.name` in a widget** — view widgets don't have a `name` prop (they're not tied to a field).
- **Don't forget to include the `widget.xml` in the assets bundle.** The glob `my_module/static/src/**/*` picks it up.
- **Don't mutate `this.props.record.data` directly.** If you need to write, use `this.props.record.update({...})`.
