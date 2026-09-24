# Odoo 19 View Widgets

Authoring custom `<widget name="...">` components — standalone widgets that aren't tied
to a field. Verified against `odoo/odoo@19.0`.

> **Sibling reference:** for `<field name="x" widget="…"/>` (tied to a specific field)
> see [field-widgets.md](./field-widgets.md). View widgets are NOT bound to a field; if
> you need the value of a field, use a field widget instead.
>
> **Related references:**
>
> - [view-architecture.md](./view-architecture.md) — `standardWidgetProps` (smaller than
>   `standardFieldProps`)
> - [arch-xml.md §5](./arch-xml.md) — `options=` on `<widget>` is parsed as **py.js**
>   (same rule as `<field>`)
> - [../examples/view-widget.md](../examples/view-widget.md) — paste-ready `banner`
>   widget

## Table of contents

1. Field widget vs view widget
2. The `view_widgets` registry
3. Descriptor shape
4. Standard props
5. How `<widget name="...">` is parsed
6. Canonical example — `web_ribbon`
7. Core view widgets shipped in 19
8. Common patterns

---

## 1. Field widget vs view widget

| Aspect                    | Field widget (`fields` registry)       | View widget (`view_widgets` registry)   |
| ------------------------- | -------------------------------------- | --------------------------------------- |
| Arch syntax               | `<field name="x" widget="phone"/>`     | `<widget name="web_ribbon"/>`           |
| Tied to a field?          | Yes                                    | No                                      |
| Receives `name` prop?     | Yes (the field name)                   | No                                      |
| Receives `record` prop?   | Yes                                    | Yes                                     |
| Receives `readonly` prop? | Yes                                    | Yes                                     |
| `extractProps` input      | `{staticInfo: fieldInfo, dynamicInfo}` | `{staticInfo: widgetInfo, dynamicInfo}` |
| Registry                  | `registry.category("fields")`          | `registry.category("view_widgets")`     |
| `supportedTypes`?         | Yes (field types)                      | No — no field type                      |

Use a **view widget** when you want to draw something at an arbitrary position in a
form/list arch that isn't tied to a specific field value — e.g. a ribbon, banner,
document link, uploader button, or info callout.

## 2. The `view_widgets` registry

```js
import {registry} from "@web/core/registry";
const viewWidgetRegistry = registry.category("view_widgets");
```

Source: `addons/web/static/src/views/widgets/widget.js` line 5.

## 3. Descriptor shape

Source: `addons/web/static/src/views/widgets/widget.js` lines 27–49
(`viewWidgetRegistry.addValidation(...)`).

```js
{
    component,           // required, OWL Component subclass
    extractProps,        // optional — (widgetInfo, dynamicInfo) => props. Omit only if your component needs no props beyond the auto-injected `record` and `readonly`.
    additionalClasses,   // optional, Array<String>
    fieldDependencies,   // optional, Array or Function (same shape as field-widget case)
    listViewWidth,       // optional
    supportedAttributes, // optional — describes XML attributes on the <widget> node (everything except `name` and `options`)
    supportedOptions,    // optional — describes keys inside options="{…}"
}
```

Both `supportedAttributes` and `supportedOptions` use the same entry shape as field
widgets' `supportedOptions` (see
[field-widgets.md §9](./field-widgets.md#9-supportedtypes-supportedoptions-supportedattributes))
**minus `isRelationalField`** (view widgets aren't relational).

Differences vs field descriptors:

- No `supportedTypes` (widgets aren't bound to a field type).
- No `relatedFields`.
- No `displayName` / `label` / `isEmpty` / `isValid`.
- Option/attribute entries omit `isRelationalField`.

## 4. Standard props

Source: `addons/web/static/src/views/widgets/standard_widget_props.js`:

```js
export const standardWidgetProps = {
  readonly: {type: Boolean, optional: true},
  record: {type: Object},
};
```

Spread them:

```js
static props = {
    ...standardWidgetProps,
    // your widget-specific props
};
```

## 5. How `<widget name="...">` is parsed

Source: `addons/web/static/src/views/widgets/widget.js` lines 65–89
(`Widget.parseWidgetNode`):

```js
static parseWidgetNode = function (node) {
    const name = node.getAttribute("name");
    const widget = viewWidgetRegistry.get(name);
    const widgetInfo = { name, widget, options: {}, attrs: {} };
    for (const { name, value } of node.attributes) {
        if (["name", "widget"].includes(name)) continue;
        if (name === "options") {
            widgetInfo.options = evaluateExpr(value);
        } else if (!name.startsWith("t-att")) {
            widgetInfo.attrs[name] = value;
        }
    }
    return widgetInfo;
};
```

Key facts:

- `options=` is **py.js** (`evaluateExpr`), not `JSON.parse`.
- Every non-`options` attribute (except `t-att*`) ends up as a **string** in
  `widgetInfo.attrs`.

Then `widgetProps` (lines 115–138) builds the final props:

```js
propsFromNode = this.widget.extractProps
  ? this.widget.extractProps(widgetInfo, dynamicInfo)
  : {};
return {
  record,
  readonly: !record.isInEdition || readonlyFromModifiers || false,
  ...propsFromNode,
};
```

So `record` and `readonly` are always injected automatically; your `extractProps` only
needs to return the widget-specific props.

## 6. Canonical example — `web_ribbon`

Source: `addons/web/static/src/views/widgets/ribbon/ribbon.js`:

```js
import {Component} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {standardWidgetProps} from "../standard_widget_props";

export class RibbonWidget extends Component {
  static template = "web.Ribbon";
  static props = {
    ...standardWidgetProps,
    record: {type: Object, optional: true},
    text: {type: String},
    title: {type: String, optional: true},
    bgClass: {type: String, optional: true},
  };
  static defaultProps = {title: "", bgClass: "text-bg-success"};
}

export const ribbonWidget = {
  component: RibbonWidget,
  extractProps: ({attrs}) => ({
    text: attrs.title || attrs.text,
    title: attrs.tooltip,
    bgClass: attrs.bg_color,
  }),
  supportedAttributes: [
    {label: _t("Title"), name: "title", type: "string"},
    {label: _t("Background color"), name: "bg_color", type: "string"},
    {label: _t("Tooltip"), name: "tooltip", type: "string"},
  ],
};

registry.category("view_widgets").add("web_ribbon", ribbonWidget);
```

Arch usage:

```xml
<widget name="web_ribbon" title="Archived" bg_color="text-bg-danger" invisible="active"/>
```

## 7. Core view widgets shipped in 19 (verified)

From `addons/web/static/src/views/widgets/`:

| Name                 | File                                       | Purpose                      |
| -------------------- | ------------------------------------------ | ---------------------------- |
| `web_ribbon`         | `ribbon/ribbon.js`                         | Corner ribbon banner on form |
| `notification_alert` | `notification_alert/notification_alert.js` | Inline alert callout         |
| `documentation_link` | `documentation_link/documentation_link.js` | Link to docs with icon       |
| `attach_document`    | `attach_document/attach_document.js`       | Button to attach a file      |
| `signature`          | `signature/signature.js`                   | Signature capture pad        |
| `week_days`          | `week_days/week_days.js`                   | Weekday toggles              |

These are all valid templates to learn from.

## 8. Common patterns

### Pass complex options

```xml
<widget name="my_widget" options="{'mode': 'compact', 'max_items': 5}"/>
```

```js
export const myWidget = {
  component: MyWidget,
  extractProps: ({options}) => ({
    mode: options.mode || "default",
    maxItems: options.max_items || 10,
  }),
};
```

### Access the current record

```js
class BannerWidget extends Component {
  static template = "my_module.Banner";
  static props = {...standardWidgetProps, threshold: Number};
  setup() {
    // record is always available
    this.orm = useService("orm");
  }
  get overBudget() {
    return this.props.record.data.amount > this.props.threshold;
  }
}
```

### Invisibility modifiers

The `invisible=` expression on a `<widget>` node works exactly like on a `<field>` —
py.js, evaluated per-render.

```xml
<widget name="web_ribbon" title="Paid" bg_color="text-bg-success"
        invisible="payment_state != 'paid'"/>
```

### Add CSS classes

```js
export const myWidget = {
  component: MyWidget,
  additionalClasses: ["o_my_widget", "d-flex", "align-items-center"],
};
```

## Common mistakes

- **Using JSON syntax for `options=`** — it's py.js. Use single quotes and
  `True`/`False`.
- **Forgetting to spread `standardWidgetProps`** — OWL props validation fails.
- **Declaring `supportedTypes`** — not a thing for view widgets. Use
  `supportedAttributes` and `supportedOptions` instead.
- **Reading `record.data.foo` without declaring `fieldDependencies`** when `foo` isn't
  already in the arch — the model won't load it.
- **Mutating `record.data`** directly — same rule as field widgets. Use
  `record.update({...})`.
