# Custom Field Widget — Paste-Ready

A custom `<field widget="color_pill">` that renders a Selection (or Char) field as a colored pill and lets you click it to cycle to the next option. Fully backed by 19.0 APIs.

## File tree

```
my_module/
├── __init__.py
├── __manifest__.py
└── static/src/
    ├── color_pill.js
    ├── color_pill.scss
    └── color_pill.xml
```

## `__manifest__.py`
```python
{
    'name': "Color Pill Field Widget",
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

## `static/src/color_pill.js`
```js
import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class ColorPillField extends Component {
    static template = "my_module.ColorPill";
    static props = {
        ...standardFieldProps,
        colors: { type: Object, optional: true },
    };
    static defaultProps = { colors: {} };

    get currentValue() {
        return this.props.record.data[this.props.name];
    }

    get label() {
        const field = this.props.record.fields[this.props.name];
        if (field.type === "selection") {
            const entry = field.selection.find(([k]) => k === this.currentValue);
            return entry ? entry[1] : this.currentValue || "";
        }
        return this.currentValue || "";
    }

    get bgColor() {
        return this.props.colors[this.currentValue] || "#888";
    }

    async cycle() {
        if (this.props.readonly) return;
        const field = this.props.record.fields[this.props.name];
        if (field.type !== "selection" || !field.selection?.length) return;
        const values = field.selection.map(([k]) => k);
        const idx = values.indexOf(this.currentValue);
        const next = values[(idx + 1) % values.length];
        await this.props.record.update({ [this.props.name]: next });
    }
}

export const colorPillField = {
    component: ColorPillField,
    displayName: _t("Color Pill"),
    supportedTypes: ["selection", "char"],
    supportedOptions: [
        {
            label: _t("Colors"),
            name: "colors",
            type: "string",
            help: _t(
                "A JSON-like mapping from value to CSS color, e.g. " +
                "{'draft': '#aaa', 'done': '#3f3'}"
            ),
            isRelationalField: false,
        },
    ],
    extractProps: ({ options }) => ({
        // `options` is already a parsed py.js object — the framework evaluated
        // options="{'colors': {'draft': '#888'}}" before calling us. Don't
        // JSON.parse it again, and expect Python-typed values (True/False/None).
        colors: options.colors || {},
    }),
    additionalClasses: ["o_color_pill_field"],
};

registry.category("fields").add("color_pill", colorPillField);
```

## `static/src/color_pill.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="my_module.ColorPill">
        <span class="o_color_pill px-2 py-1 rounded-pill text-white small"
              t-att-style="`background: ${bgColor}; cursor: ${props.readonly ? 'default' : 'pointer'};`"
              t-on-click="cycle">
            <t t-esc="label"/>
        </span>
    </t>
</templates>
```

## `static/src/color_pill.scss`
```scss
.o_color_pill_field {
    display: inline-block;
    .o_color_pill {
        user-select: none;
        transition: transform 0.12s;
        &:hover { transform: scale(1.04); }
    }
}
```

## Usage in arch

```xml
<field name="state"
       widget="color_pill"
       options="{'colors': {'draft': '#888', 'confirmed': '#f90', 'done': '#3a3'}}"/>
```

## What's verified

- `standardFieldProps` — `addons/web/static/src/views/fields/standard_field_props.js`.
- `registry.category("fields").add(...)` validator shape — `addons/web/static/src/views/fields/field.js` lines 65–115.
- `record.update({[name]: value})` — `addons/web/static/src/model/relational_model/record.js` lines 311–321.
- `extractProps({options})` signature — same file, lines 410–468.
- `options="..."` on `<field>` parsed as py.js, not strict JSON — so `{'colors': {'draft': '#888', ...}}` (single quotes, Python syntax) is correct.
- `additionalClasses` validated on descriptor — `field.js` line 74.

## View-specific variant

If you want different behavior in a list view (e.g. no click-to-cycle), register a prefixed variant:

```js
class ListColorPill extends ColorPillField {
    cycle() { /* no-op in list */ }
}

registry.category("fields").add("list.color_pill", {
    ...colorPillField,
    component: ListColorPill,
});
```

Resolution order in `field.js` (lines 122–143) prefers `list.color_pill` over `color_pill` for list views.
