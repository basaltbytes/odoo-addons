# Odoo 19 View Widgets

Use this for standalone `<widget name="...">` components. If the UI is tied to a field value, use [field-widgets](./field-widgets.md) instead.

## Table of Contents

1. Field widget vs view widget
2. Registry and descriptor
3. Props and parsing
4. Patterns
5. Common mistakes
6. Source anchors

## 1. Field Widget vs View Widget

| Aspect | Field widget | View widget |
| --- | --- | --- |
| Arch syntax | `<field name="x" widget="phone"/>` | `<widget name="web_ribbon"/>` |
| Registry | `fields` | `view_widgets` |
| Bound to a field? | Yes | No |
| Receives `name` prop? | Yes | No |
| Receives `record` / `readonly`? | Yes | Yes |
| Has `supportedTypes`? | Yes | No |
| Has `relatedFields`? | Yes, for relational widgets | No |

Use a view widget for banners, ribbons, alerts, buttons, links, uploaders, and callouts that sit in a view but are not themselves a field renderer.

## 2. Registry and Descriptor

```js
registry.category("view_widgets").add("my_banner", {
    component: MyBanner,
    extractProps: ({ attrs, options }) => ({
        title: attrs.title,
        mode: options.mode || "info",
    }),
    supportedAttributes: [{ label: _t("Title"), name: "title", type: "string" }],
    supportedOptions: [{ label: _t("Mode"), name: "mode", type: "string" }],
});
```

Descriptor keys agents usually need:

| Key | Use |
| --- | --- |
| `component` | Required Owl component class |
| `extractProps(widgetInfo, dynamicInfo)` | Returns widget-specific props |
| `fieldDependencies` | Same-record fields the widget reads but the arch did not request |
| `additionalClasses` | Classes added to the wrapper |
| `supportedAttributes` | Documents plain XML attrs except `name` and `options` |
| `supportedOptions` | Documents keys inside `options="{...}"` |

Unlike field widgets, view widgets do not support `supportedTypes`, `relatedFields`, `displayName`, `label`, `isEmpty`, or `isValid`.

## 3. Props and Parsing

Always spread `standardWidgetProps`:

```js
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

class MyBanner extends Component {
    static props = {
        ...standardWidgetProps,
        title: String,
    };
}
```

The framework injects `record` and `readonly`. Your `extractProps` returns only widget-specific props.

`<widget>` parsing rules:

- `options=` is parsed with Odoo py.js, not `JSON.parse`.
- Non-`options` XML attributes become strings in `widgetInfo.attrs`.
- `record` and `readonly` are added after `extractProps`.
- `invisible=` works like a field modifier and is evaluated per render.

Example arch:

```xml
<widget name="my_banner"
        title="Over budget"
        options="{'mode': 'warning', 'threshold': 5000}"
        invisible="amount_total &lt;= 5000"/>
```

## 4. Patterns

Read current record data through the injected record:

```js
get overBudget() {
    return this.props.record.data.amount_total > this.props.threshold;
}
```

If the widget needs fields not already present in the arch, declare them:

```js
fieldDependencies: [{ name: "amount_total", type: "monetary" }],
```

Core widgets worth copying from source:

| Name | Purpose |
| --- | --- |
| `web_ribbon` | Form corner ribbon |
| `notification_alert` | Inline alert callout |
| `documentation_link` | Documentation link with icon |
| `attach_document` | Attachment button |
| `signature` | Signature capture |
| `week_days` | Weekday toggles |

For paste-ready scaffolding, load [view-widget](../examples/view-widget.md).

## 5. Common Mistakes

- Using a view widget when a field widget is needed.
- Missing `standardWidgetProps`.
- Declaring `supportedTypes`; view widgets are not field renderers.
- Calling `JSON.parse(options)`.
- Reading undeclared record fields without `fieldDependencies`.
- Mutating `record.data` directly; use `record.update`.

## 6. Source Anchors

- `addons/web/static/src/views/widgets/widget.js`: `view_widgets` registry validation, node parsing, prop injection.
- `addons/web/static/src/views/widgets/standard_widget_props.js`: standard widget props.
- `addons/web/static/src/views/widgets/ribbon/ribbon.js`: canonical `web_ribbon` implementation.
- `addons/web/static/src/views/widgets/`: built-in widget catalogue.
