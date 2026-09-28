# Odoo 19 Field Widgets

Use this when authoring or reviewing `<field widget="...">` components. For paste-ready code, load [field-widget](../examples/field-widget.md).

## Table of Contents

1. Registry and descriptor
2. Standard props
3. Arch parsing and `extractProps`
4. Data loading
5. Reading and writing values
6. Extension patterns
7. Common mistakes
8. Source anchors

## 1. Registry and Descriptor

Register field widgets in `registry.category("fields")`:

```js
registry.category("fields").add("color_pill", {
    component: ColorPillField,
    displayName: _t("Color Pill"),
    supportedTypes: ["selection", "char"],
    extractProps: ({ options }) => ({ colors: options.colors || {} }),
});
```

Descriptor keys agents usually need:

| Key | Use |
| --- | --- |
| `component` | Required Owl component class |
| `supportedTypes` | Field types accepted; mismatch is a console warning, not a hard error |
| `extractProps(staticInfo, dynamicInfo)` | Converts parsed arch info into component props |
| `supportedOptions` | Documents and validates keys inside `options="{...}"` |
| `supportedAttributes` | Documents and validates plain XML attributes |
| `fieldDependencies` | Same-record fields your widget reads but the arch did not request |
| `relatedFields` | Co-model fields for relational widgets |
| `additionalClasses` | Classes added to the field wrapper |
| `isEmpty` / `isValid` | Visual state only; does not block save |

Valid `supportedTypes` include `binary`, `boolean`, `json`, `integer`, `float`, `monetary`, `reference`, `many2one_reference`, `many2one`, `one2many`, `many2many`, `selection`, `date`, `datetime`, `char`, `text`, and `html`.

## 2. Standard Props

Always spread `standardFieldProps`; the framework passes these props to every field widget:

```js
import { standardFieldProps } from "@web/views/fields/standard_field_props";

class ColorPillField extends Component {
    static props = {
        ...standardFieldProps,
        colors: { type: Object, optional: true },
    };
}
```

They provide `id?`, `name`, `readonly?`, and `record`. Omitting them breaks Owl prop validation when dev mode is enabled.

## 3. Arch Parsing and `extractProps`

`extractProps` receives:

```js
extractProps(staticInfo, dynamicInfo)
```

Important `staticInfo` keys:

| Key | Meaning |
| --- | --- |
| `name`, `type`, `viewType`, `widget`, `field` | Field identity and descriptor context |
| `options` | Already parsed with Odoo py.js; do not `JSON.parse` |
| `attrs` | Remaining XML attributes as strings |
| `context`, `domain`, `invisible`, `readonly`, `required`, `column_invisible` | Arch expressions as strings |
| `decorations` | Decoration expressions such as `danger`, `warning`, `muted`, `bf`, `it` |

Important `dynamicInfo` keys are lazy `context`, `domain()`, `required`, and `readonly`. Use them when props depend on current record state.

Widget resolution prefers the most specific registration:

1. `<jsClass>.<widget>`
2. `<viewType>.<widget>`
3. `<widget>`
4. Same cascade using field type fallback, such as `list.char` then `char`

## 4. Data Loading

Use `fieldDependencies` for sibling fields on the same record:

```js
fieldDependencies: [{ name: "write_date", type: "datetime" }],
```

Use `relatedFields` for fields on a relational co-model:

```js
relatedFields: [{ name: "display_name", type: "char" }],
```

Both can be functions receiving `{ type, attrs, options, viewType }`. Do not mix them up: missing dependencies usually fail as `undefined` data, not a loud exception.

## 5. Reading and Writing Values

Read through the reactive record:

```js
const value = this.props.record.data[this.props.name];
```

Write through the model:

```js
await this.props.record.update({ [this.props.name]: newValue });
```

Never mutate `record.data` directly. It bypasses the model mutex, onchange, dirty tracking, save points, and validation hooks.

For text-like inputs, prefer `useInputField({ getValue, parse, refName })`; it preserves the core commit semantics used by built-in text and numeric widgets.

## 6. Extension Patterns

If a built-in widget is mostly right, spread its descriptor instead of recreating the whole contract:

```js
import { charField } from "@web/views/fields/char/char_field";

class NameGeneratorField extends charField.component {
    static template = "my_module.NameGeneratorField";
    static props = { ...charField.component.props };

    generate() {
        this.props.record.update({ [this.props.name]: "Bella" });
    }
}

registry.category("fields").add("name_generator", {
    ...charField,
    component: NameGeneratorField,
});
```

For many2one variants, use `buildM2OFieldDescription(Many2OneField)` and layer new props, dependencies, or template behavior on top of the base descriptor.

## 7. Common Mistakes

- Missing `standardFieldProps`.
- Calling `JSON.parse(options)` even though field `options=` is py.js.
- Mutating `record.data` instead of using `record.update`.
- Reading undeclared sibling fields without `fieldDependencies`.
- Using `relatedFields` for same-record fields.
- Rebuilding a core descriptor when a spread/subclass would preserve stock behavior.
- Omitting `supportedOptions` / `supportedAttributes` for custom arch API.

## 8. Source Anchors

- `addons/web/static/src/views/fields/field.js`: field registry validation, widget resolution, field parsing, `extractProps` call path.
- `addons/web/static/src/views/fields/standard_field_props.js`: standard field props.
- `addons/web/static/src/model/relational_model/record.js`: `record.update`.
- `addons/web/static/src/views/fields/char/char_field.js`: compact built-in field example.
- `addons/web/static/src/views/fields/many2one/many2one_field.js`: many2one descriptor factory.
- `addons/web/static/src/views/fields/input_field_hook.js`: input commit helper.
