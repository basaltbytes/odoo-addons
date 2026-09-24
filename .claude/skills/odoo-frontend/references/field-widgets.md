# Odoo 19 Field Widgets

Authoring custom `<field widget="...">` components. Every claim sourced from
`odoo/odoo@19.0`.

> **Sibling reference:** for standalone `<widget name="…"/>` nodes (not tied to a field)
> see [view-widgets.md](./view-widgets.md). The two have similar contracts but receive
> different inputs.
>
> **Related references:**
>
> - [view-architecture.md](./view-architecture.md) — `standardFieldProps` lives in the
>   standard-props contract section
> - [arch-xml.md §6](./arch-xml.md) — `options=` is parsed as **py.js** before
>   `extractProps` is called (no `JSON.parse` needed)
> - [../examples/field-widget.md](../examples/field-widget.md) — paste-ready
>   `color_pill` widget

## Table of contents

1. The `fields` registry
2. Descriptor shape (validation schema)
3. Standard props contract
4. Arch parsing — how `extractProps` is called
5. Minimal canonical example — `CharField`
6. Relational pattern — `Many2OneField`
7. Prefixed registrations — `"list.phone"`, `"form.phone"`
8. `fieldDependencies` and `relatedFields`
9. `supportedTypes`, `supportedOptions`, `supportedAttributes`
10. Reading and writing values
11. Extending built-ins safely
12. Hooks you'll actually use

---

## 1. The `fields` registry

```js
import {registry} from "@web/core/registry";
const fieldRegistry = registry.category("fields");
```

Source: `addons/web/static/src/views/fields/field.js` line 15.

Add with:

```js
registry.category("fields").add(name, descriptor, {force, sequence});
```

Valid type strings (enforced by `supportedTypes` validator at `field.js` lines 17–37):

```
binary, boolean, json, integer, float, monetary, properties, properties_definition,
reference, many2one_reference, many2one, one2many, many2many, selection,
date, datetime, char, text, html
```

## 2. Descriptor shape

Source: `field.js` lines 65–115 (`fieldRegistry.addValidation(...)`). Full shape:

```js
{
    component,                      // required, OWL Component subclass
    displayName,                    // String, optional — human name
    supportedTypes,                 // Array<String>, optional — field types accepted
    supportedOptions,               // Array<Object>, optional — see §9
    supportedAttributes,            // Array<Object>, optional — same shape as supportedOptions
    extractProps,                   // Function(staticInfo, dynamicInfo) => props
    isEmpty,                        // Function(record, fieldName) => boolean (visual feedback)
    isValid,                        // Function(record, fieldName, fieldInfo) => boolean (visual feedback)
    additionalClasses,              // Array<String>, CSS classes to add to wrapper
    fieldDependencies,              // Array<{name, type}> or Function({type, attrs, options, viewType}) => Array
    relatedFields,                  // for relational widgets — fields to read from co-model
    useSubView,                     // Boolean — relational x2m widgets with sub-view
    label,                          // String|false, optional — override label
    listViewWidth,                  // Number|Array|Function — column width hint
}
```

## 3. Standard props

Source: `addons/web/static/src/views/fields/standard_field_props.js`:

```js
export const standardFieldProps = {
  id: {type: String, optional: true},
  name: {type: String},
  readonly: {type: Boolean, optional: true},
  record: {type: Object},
};
```

Always spread them:

```js
static props = {
    ...standardFieldProps,
    // your widget-specific props here
};
```

Omitting them causes OWL's props validator to fail when the framework passes `record`,
`name`, or `readonly`.

## 4. How a field is resolved and parsed

Source: `field.js` `Field.parseFieldNode` (lines 224–355) — called by every view's
ArchParser when it encounters `<field name="..."/>`.

Resolution order for the widget descriptor (`getFieldFromRegistry`, lines 122–143):

1. `<jsClass>.<widget>` (e.g. `my_kanban.phone`)
2. `<viewType>.<widget>` (e.g. `list.phone`)
3. `<widget>` alone (e.g. `phone`)
4. Then the same cascade with the field **type** as fallback (`list.char`, `char`).

If a widget is named but missing, you get
`Missing widget: ${widget} for field of type ...` in the console.

If the widget's `supportedTypes` is declared and doesn't include the current field's
type, you get `The widget: ${widget} don't support the type ${fieldType}` warning.
**It's only a console warning — not a hard error.**

### `extractProps` contract

Source: `field.js` lines 410–468 (`Field.fieldComponentProps` getter):

```js
const dynamicInfo = {
    get context() { return getFieldContext(record, fieldInfo.name, fieldInfo.context); },
    domain() { ... },
    required: evaluateBooleanExpr(fieldInfo.required, record.evalContextWithVirtualIds),
    readonly,
};
propsFromNode = this.field.extractProps(fieldInfo, dynamicInfo);
```

Shape of `fieldInfo` (the `staticInfo` first argument):

```js
{
    name, type, viewType, widget, field,
    context, string, help,
    onChange, forceSave,
    options,         // already parsed with evaluateExpr (py.js)
    decorations,     // { invisible: expr, danger: expr, warning: expr, info: expr, muted: expr, bf: expr, it: expr }
    attrs,           // every remaining XML attribute as a String
    domain,
    invisible, column_invisible, readonly, required,  // modifier expressions as Strings
    placeholder,
}
```

## 5. Minimal canonical example — `CharField`

Source: `addons/web/static/src/views/fields/char/char_field.js`:

```js
import {Component, useRef} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {useInputField} from "@web/views/fields/input_field_hook";
import {standardFieldProps} from "../standard_field_props";
import {exprToBoolean} from "@web/core/utils/strings";

export class CharField extends Component {
  static template = "web.CharField";
  static props = {
    ...standardFieldProps,
    autocomplete: {type: String, optional: true},
    isPassword: {type: Boolean, optional: true},
    placeholder: {type: String, optional: true},
    dynamicPlaceholder: {type: Boolean, optional: true},
    dynamicPlaceholderModelReferenceField: {type: String, optional: true},
  };
  static defaultProps = {dynamicPlaceholder: false};

  setup() {
    this.input = useRef("input");
    useInputField({
      getValue: () => this.props.record.data[this.props.name] || "",
      parse: (v) => this.parse(v),
    });
  }

  parse(v) {
    return v;
  }
}

export const charField = {
  component: CharField,
  displayName: _t("Text"),
  supportedTypes: ["char", "text"],
  supportedOptions: [
    {
      label: _t("Dynamic Placeholder"),
      name: "dynamic_placeholder",
      type: "boolean",
      help: _t("Enables dynamic placeholders (mail merge style)."),
    },
  ],
  extractProps: ({attrs, options, placeholder}) => ({
    isPassword: exprToBoolean(attrs.password),
    dynamicPlaceholder: options.dynamic_placeholder || false,
    dynamicPlaceholderModelReferenceField:
      options.dynamic_placeholder_model_reference_field || "",
    autocomplete: attrs.autocomplete,
    placeholder,
  }),
};

registry.category("fields").add("char", charField);
```

This file is the best canonical example — short, complete, and uses most of the APIs.

## 6. Relational pattern — `Many2OneField`

Source: `addons/web/static/src/views/fields/many2one/many2one_field.js` lines 61–122:

```js
export function buildM2OFieldDescription(Component) {
  return {
    component: Component,
    displayName: _t("Many2one"),
    supportedTypes: ["many2one"],
    supportedOptions: [
      /* many options */
    ],
    extractProps: extractM2OFieldProps,
    additionalClasses: ["o_field_many2one"],
  };
}

registry
  .category("fields")
  .add("many2one", {...buildM2OFieldDescription(Many2OneField)});
```

Relational widgets typically declare `relatedFields` to fetch additional co-model data
and/or `fieldDependencies` to load sibling fields needed for computations.

`extractM2OFieldProps` uses both `staticInfo` (attrs, options, string, placeholder,
context, decorations) and `dynamicInfo` (context, domain, readonly).

## 7. Prefixed registrations

Source: `field.js` lines 122–143.

Same widget, different behaviour per view type:

```js
// Default for any view
registry.category("fields").add("phone", phoneField);

// Form-view specific (adds a click-to-call link, e.g.)
registry.category("fields").add("form.phone", formPhoneField);

// jsClass-specific (used when the arch has js_class="awesome_kanban")
registry.category("fields").add("awesome_kanban.phone", awesomePhoneField);
```

Resolution picks the most-specific available: `jsClass.widget` > `viewType.widget` >
`widget`. This is documented by the canonical `phone_field.js` (registration at lines 40
and 51).

## 8. `fieldDependencies` and `relatedFields`

### `fieldDependencies`

Fields on the **same record** that your widget reads but aren't explicitly declared in
the arch. Declare them so the model fetches them.

Static form:

```js
export const imageField = {
  component: ImageField,
  // ...
  fieldDependencies: [{name: "write_date", type: "datetime"}],
};
```

Source: `addons/web/static/src/views/fields/image/image_field.js` line 288.

Dynamic form (function):

```js
fieldDependencies: ({ type, attrs, options }) => {
    const deps = [];
    if (options.timezone_field) {
        deps.push({ name: options.timezone_field, type: "selection" });
    }
    return deps;
},
```

Source pattern: `addons/web/static/src/views/fields/datetime/datetime_field.js`
line 431.

### `relatedFields`

For relational widgets ONLY (many2one, one2many, many2many): fields to read **from the
co-model**. Shape:

```js
relatedFields: [{ name: "display_name", type: "char" }],
```

Can also be a function receiving the same args as `fieldDependencies`.

> **Quick rule:** sibling fields on the **same record** → `fieldDependencies`. Fields on
> the **co-model** of a relational → `relatedFields`. Mixing them up causes "field not
> loaded" silent failures.

## 9. `supportedTypes`, `supportedOptions`, `supportedAttributes`

### `supportedTypes`

Array of strings. Used only for the console warning at parse time. Not a hard constraint
— you can register a widget and use it on any field type, but if you declare
`supportedTypes` you opt into the safety net.

### `supportedOptions` and `supportedAttributes`

Array of objects. Validated at descriptor registration time. Each entry:

```js
{
    label: String,                // REQUIRED — _t()-wrapped human label
    name: String,                 // REQUIRED — the options key (e.g. "no_create")
    type: String,                 // REQUIRED — "boolean" | "number" | "string" | "field" | ...
    availableTypes: [String],     // optional — allowed field types if type === "field"
    default: String,              // optional
    help: String,                 // optional — _t()-wrapped help text
    choices: [{label, value}],    // optional — for enumeration-style options
    isRelationalField: Boolean,   // REQUIRED for field widgets when type === "field" on a relational; absent on view widgets
}
```

Source: `field.js` lines 39–63 (required shape).

`supportedOptions` describes things the user puts in `options="{...}"`;
`supportedAttributes` describes other XML attributes on the `<field>` node (e.g.
`password`). Same shape; different source attribute on the arch node.

These are surfaced by Studio-style tooling and (in principle) by developer tools. They
also double as machine-readable documentation. **Declare them** — your future self and
other devs will thank you.

## 10. Reading and writing values

### Reading

```js
const value = this.props.record.data[this.props.name];
```

This is reactive — re-reading inside a `setup`/`render` subscribes to the field and
causes re-render on change. This is the pattern in every core widget.

### Writing

```js
this.props.record.update({[this.props.name]: newValue});
// or commit immediately:
this.props.record.update({[this.props.name]: newValue}, {save: true});
```

### `isEmpty` and `isValid`

Two optional descriptor functions used **only for visual state** (the field's
empty-state placeholder, invalid-state border). They do not block save and they do not
run server-side.

```js
export const myField = {
  component: MyField,
  isEmpty: (record, fieldName) => !record.data[fieldName],
  isValid: (record, fieldName) => /* your check */ true,
};
```

For falsy/empty checks the default behaviour usually suffices — only override when your
widget has a non-trivial empty state (e.g. a JSON field where `{}` should count as
empty).

Source: `addons/web/static/src/model/relational_model/record.js` lines 311–321:

```js
update(changes, { save } = {}) {
    if (this.model._urgentSave) return this._update(changes);
    return this.model.mutex.exec(async () => {
        await this._update(changes, { withoutOnchange: save });
        if (save && this.canSaveOnUpdate) return this._save();
    });
}
```

**Never write to `record.data` directly.** That bypasses:

- The model mutex (concurrent-save safety)
- Onchange dispatch
- Dirty-tracking and save-points
- The "set field invalid" hook chain

## 11. Extending built-ins safely

When a widget only needs to add one behavior, prefer subclassing the core widget
component and spreading the core descriptor instead of rebuilding the whole contract
from scratch.

### Extend a `char` widget and keep the existing descriptor

```js
import {charField} from "@web/views/fields/char/char_field";

class NameGeneratorField extends charField.component {
  static template = "my_module.NameGeneratorField";
  static props = {...charField.component.props};

  generate() {
    this.props.record.update({[this.props.name]: "Bella"});
  }
}

const nameGeneratorField = {
  ...charField,
  component: NameGeneratorField,
};
```

This preserves the stock char-field parsing, supported types, and input semantics.

### Extend `Many2OneField` with `buildM2OFieldDescription(...)`

```js
import {
  Many2OneField,
  buildM2OFieldDescription,
} from "@web/views/fields/many2one/many2one_field";

const baseField = buildM2OFieldDescription(Many2OneField);

class AnimalTypeManyToOne extends Many2OneField {
  static template = "my_module.AnimalTypeManyToOne";
  static props = {...Many2OneField.props, imageField: {type: String}};
}

const animalTypeMany2One = {
  ...baseField,
  component: AnimalTypeManyToOne,
  fieldDependencies: [
    ...(baseField.fieldDependencies || []),
    {name: "pictogram", type: "image"},
  ],
  extractProps({options}) {
    const props = baseField.extractProps(...arguments);
    props.imageField = options.image_field;
    return props;
  },
};
```

This is the safest pattern when you are still fundamentally a many2one widget and only
need extra props, a custom template, or extra loaded fields.

### Extend a statusbar field and keep the original template

```js
import {useService} from "@web/core/utils/hooks";
import {statusBarField} from "@web/views/fields/statusbar/statusbar_field";

class StatusbarRainbowManField extends statusBarField.component {
  static props = {
    ...statusBarField.component.props,
    rainbowStages: {type: Array},
  };
  static template = statusBarField.component.template;

  setup() {
    super.setup();
    this.effect = useService("effect");
  }

  async selectItem(item) {
    super.selectItem(item);
    if (this.props.rainbowStages.includes(item.value)) {
      this.effect.add({message: "A new happy life on the making"});
    }
  }
}
```

This pattern is lower-risk than rewriting the widget because it preserves the original
rendering and state transitions, then layers one side effect on top.

## 12. Hooks you'll actually use

| Hook                                        | Where it lives                                 | What it does                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `useInputField({getValue, parse, refName})` | `@web/views/fields/input_field_hook`           | Binds an `<input>`/`<textarea>` to a field with correct dirty/commit semantics. Used by CharField, IntegerField, FloatField. |
| `useNumpadDecimal()`                        | `@web/views/fields/numpad_decimal_hook`        | Translates the number-pad decimal key for locales where `,` is used. Used by numeric fields.                                 |
| `useService("orm")`                         | `@web/core/utils/hooks`                        | Get the ORM service for ad-hoc RPC from the widget.                                                                          |
| `useRecordObserver(callback)`               | `@web/model/relational_model/utils` (line 762) | Runs `callback` on setup and every time a value _read inside it_ on the record changes. Useful for reactive side-effects.    |

## Common mistakes

- **Forgetting to spread `standardFieldProps`** — OWL props validation fails.
- **Pure JSON mindset for `options=`** — it's py.js; prefer Python idioms
  (`True`/`'str'`).
- **Missing `supportedTypes`** for widgets that shouldn't apply to every type — you get
  silent misapplication, only a console warning.
- **Mutating `record.data.foo`** — bypasses mutex and onchange. Use `record.update`.
- **Reading extra fields without `fieldDependencies`** — the model won't load them and
  `record.data[other_field]` will be `undefined`.
- **`supportedOptions` entries missing `label`/`name`/`type`** — registry validator
  rejects the descriptor at add time.
