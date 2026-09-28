# Odoo 19 View Architecture

Use this for the JS view framework contract: descriptors, controllers, models, renderers, `js_class`, search integration, and standard props. For a runnable new view, load [custom-view-minimal](../examples/custom-view-minimal.md) or [view-registration](./view-registration.md).

## Table of Contents

1. Views registry
2. Descriptor keys
3. Runtime pieces
4. Runtime resolution
5. Layout and search
6. Models and records
7. Standard props
8. Source anchors

## 1. Views Registry

Register view descriptors in `registry.category("views")`:

```js
registry.category("views").add("my_view", myView);
```

Odoo validates two things at registration time:

- `type` must exist in `session.view_info`.
- `Controller` must extend Owl `Component`.

For a brand-new root view type, add it server-side through `ir.ui.view.type` and `_get_view_info()` before registering the JS descriptor.

## 2. Descriptor Keys

The registry value is a plain object. Common keys:

| Key | Use |
| --- | --- |
| `type` | Server-visible view type, such as `list`, `form`, or `my_view` |
| `Controller` | Root Owl component |
| `Renderer` | Component that renders model data |
| `ArchParser` | Class with `parse(arch, relatedModels, resModel)` |
| `Model` | Data model class, often `RelationalModel` |
| `Compiler` | Optional arch-to-template compiler, used by form/kanban |
| `SearchModel` | Optional search model override, used by graph/pivot |
| `ControlPanel` / `SearchPanel` | Optional component overrides |
| `searchMenuTypes` | Menus to show: `filter`, `groupBy`, `favorite`; form uses `[]` |
| `buttonTemplate` | QWeb template id for control-panel buttons |
| `display` | Default layout display flags |
| `props(genericProps, view, config)` | Builds final controller props |
| `display_name`, `icon`, `multiRecord` | View switcher and metadata |

Use built-in descriptors as patterns. `list` uses `RelationalModel`, `ListArchParser`, `ListController`, `ListRenderer`, and a `props` function that parses arch info before passing props to the controller.

## 3. Runtime Pieces

| Piece | Rule |
| --- | --- |
| `ArchParser` | Synchronous, no Owl. Converts XML into `archInfo`. |
| `Model` | Owns loading/mutation, exposes `root`, emits updates. |
| `Renderer` | Pure Owl rendering. Do not fetch here. |
| `Controller` | Owns `Layout`, services, model hook, and renderer wiring. |
| `Compiler` | Optional. Only needed when your arch contains QWeb-style templates. |
| Descriptor | Plain object registered in `views`. |

Typical controller shape:

```js
class MyController extends Component {
    static template = "my_module.MyController";
    static components = { Layout, Renderer: MyRenderer };
    static props = { ...standardViewProps, Model: Function, Renderer: Function, archInfo: Object };

    setup() {
        this.model = useState(useModel(this.props.Model, this.modelParams));
        useSubEnv({ model: this.model });
    }
}
```

Use `useModelWithSampleData` for list/kanban-style empty states; use `useModel` for form-like or custom data models.

## 4. Runtime Resolution

`View.loadView` resolves the descriptor in this order:

1. Validate `type` against `session.view_info`.
2. Load the arch if it was not provided inline.
3. Resolve the registry key from `arch@js_class`, then `props.jsClass`, then `type`.
4. If missing, load the relevant lazy bundle and check the registry again.
5. Call `descr.props(viewProps, descr, env.config)`.
6. Render the controller inside `WithSearch`.

Implications:

- `js_class` customizes a view instance without defining a new root tag.
- A new root type needs server-side view type metadata; `js_class` variants usually do not.
- Lazy-bundle bugs often look like missing registry keys.

## 5. Layout and Search

Controllers usually render `Layout` from `@web/search/layout`:

```xml
<Layout className="props.className" display="props.display">
    <t t-set-slot="layout-buttons">
        <button class="btn btn-primary" t-on-click="onCreate">New</button>
    </t>
    <Renderer t-props="rendererProps"/>
</Layout>
```

Set `ControlPanel` or `SearchPanel` on the view descriptor to override those components. Search values arrive through controller props from `WithSearch`: `context`, `domain`, `groupBy`, `orderBy`, and `display`.

## 6. Models and Records

`ModelClass.services` lists services to inject; `RelationalModel` uses `action`, `dialog`, `notification`, and `orm`.

`RelationalModel` root datapoints:

| Root | Use |
| --- | --- |
| `Record` | Form view |
| `DynamicRecordList` | Flat list/kanban |
| `DynamicGroupList` | Grouped list/kanban |
| `StaticList` | x2many sub-records |

Read values through `record.data[fieldName]`. Write through `record.update({ field_name: value })`; direct `record.data` mutation bypasses model mutex, onchange, dirty tracking, and save hooks.

## 7. Standard Props

Custom controllers should spread `standardViewProps` and add their own props:

```js
static props = {
    ...standardViewProps,
    Model: Function,
    Renderer: Function,
    archInfo: Object,
};
```

Important controller props include `resModel`, `arch`, `context`, `domain`, `fields`, `groupBy`, `orderBy`, `display`, `resId`, `resIds`, `searchMenuTypes`, `createRecord`, `selectRecord`, and `updateActionState`.

Field widgets and view widgets have narrower contracts; use [field-widgets](./field-widgets.md) and [view-widgets](./view-widgets.md) instead of repeating those props here.

## 8. Source Anchors

- `addons/web/static/src/views/view.js`: `View`, registry validation, `js_class` resolution, controller prop creation.
- `addons/web/static/src/views/view.xml`: `WithSearch` wrapper.
- `addons/web/static/src/views/standard_view_props.js`: controller props.
- `addons/web/static/src/model/model.js`: `Model`, `useModel`, `useModelWithSampleData`.
- `addons/web/static/src/model/relational_model/relational_model.js`: `RelationalModel`.
- `addons/web/static/src/model/relational_model/record.js`: `record.update`.
- `addons/web/static/src/search/layout.js` and `layout.xml`: `Layout`, control panel, search panel.
- `addons/web/static/src/views/list/list_view.js`, `form/form_view.js`, `kanban/kanban_view.js`: canonical descriptors.
- `addons/web/models/ir_ui_view.py`: `_get_view_info`.
- `odoo/addons/base/models/ir_ui_view.py`: `ir.ui.view.type`.
