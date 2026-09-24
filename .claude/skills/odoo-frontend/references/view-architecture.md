# Odoo 19 View Architecture

How the JS view framework is put together, verified against `odoo/odoo@19.0`. Every
statement has a source path.

> **Verification status:** all claims verified against open-source `odoo/odoo@19.0`.
> Enterprise extension patterns (e.g. `selection_add` from a private addon) follow the
> same Odoo ORM idiom but are **UNVERIFIED** against private 19.0 enterprise source.
>
> **Related references:**
>
> - [view-registration.md](./view-registration.md) — bootstrapping a new view type
>   (Python + JS + arch)
> - [arch-xml.md](./arch-xml.md) — arch attributes, modifiers, options
> - [view-inheritance.md](./view-inheritance.md) — XPath inheritance
> - [field-widgets.md](./field-widgets.md) / [view-widgets.md](./view-widgets.md) —
>   widget contracts
>
> Read [../SKILL.md](../SKILL.md) first for the 5-piece mental model. This file is the
> deep reference: full descriptor key catalogue, canonical built-in descriptors
> verbatim, runtime resolution path, and standard props contracts.

## Table of contents

1. The `views` registry
2. The view descriptor object
3. The five (or six) pieces: ArchParser, Model, Renderer, Controller, Compiler,
   descriptor
4. How a view is resolved at runtime
5. Layout, ControlPanel, SearchPanel
6. `useModel` and lifecycle
7. `RelationalModel` essentials
8. Standard props contracts

---

## 1. The `views` registry

```js
import {registry} from "@web/core/registry";
const viewRegistry = registry.category("views");
```

Added in `addons/web/static/src/views/view.js` line 91 with a validation schema:

```js
viewRegistry.addValidation({
  type: {validate: (t) => t in session.view_info},
  Controller: {validate: (c) => c.prototype instanceof Component},
  "*": true,
});
```

- `type` must be a key of `session.view_info` (populated server-side; see §4).
- `Controller` must extend OWL's `Component`.
- Any other property is accepted.

Source: https://github.com/odoo/odoo/blob/19.0/addons/web/static/src/views/view.js

The 19.0 docs confirm the general registry concept:
https://www.odoo.com/documentation/19.0/developer/reference/frontend/registries.html

## 2. The view descriptor object

The value stored in the registry is a **plain object** (not a class). Its keys are read
by `view.js` and/or forwarded to the Controller. Verified keys (from `view.js` + all
built-in views):

| Key                 | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `type`              | (string) the view type — must be in `session.view_info`                              |
| `Controller`        | (Component class) root OWL component                                                 |
| `Renderer`          | (Component class) sub-component rendering the data                                   |
| `ArchParser`        | (class with `.parse(arch, relatedModels, resModel)`)                                 |
| `Model`             | (class extending `Model` from `@web/model/model`)                                    |
| `Compiler`          | (optional) QWeb-to-OWL template compiler — used by `form` and `kanban`               |
| `SearchModel`       | (optional) override the default search model — used by `graph` and `pivot`           |
| `ControlPanel`      | (optional Component class) overrides the default control panel                       |
| `SearchPanel`       | (optional Component class) overrides the default search panel                        |
| `searchMenuTypes`   | (array) which search menus to show: `filter`, `groupBy`, `favorite` — form sets `[]` |
| `canOrderByCount`   | (boolean) `list` sets `true` — allows sorting groups by count                        |
| `hideCustomGroupBy` | (boolean) hide the "custom group by" menu                                            |
| `display`           | (object) default `display` settings                                                  |
| `buttonTemplate`    | (string) QWeb template id for buttons, e.g. `"web.ListView.Buttons"`                 |
| `props`             | (function) `(genericProps, view, config) => controllerProps`                         |
| `display_name`      | (string) shown in the view switcher (when you add a type)                            |
| `icon`              | (string) CSS class for the switcher icon                                             |
| `multiRecord`       | (boolean) whether the view handles multiple records                                  |

Source: `addons/web/static/src/views/view.js` lines 147–188 (STANDARD_PROPS and line 197
for class-level defaults).

### 2.1 Canonical built-in descriptors (verbatim)

**List** (`addons/web/static/src/views/list/list_view.js`):

```js
import {registry} from "@web/core/registry";
import {RelationalModel} from "@web/model/relational_model/relational_model";
import {ListArchParser} from "./list_arch_parser";
import {ListController} from "./list_controller";
import {ListRenderer} from "./list_renderer";

export const listView = {
  type: "list",
  Controller: ListController,
  Renderer: ListRenderer,
  ArchParser: ListArchParser,
  Model: RelationalModel,
  buttonTemplate: "web.ListView.Buttons",
  canOrderByCount: true,
  props: (genericProps, view) => {
    const {ArchParser} = view;
    const {arch, relatedModels, resModel} = genericProps;
    const archInfo = new ArchParser().parse(arch, relatedModels, resModel);
    return {
      ...genericProps,
      readonly: genericProps.readonly || !archInfo.activeActions?.edit,
      Model: view.Model,
      Renderer: view.Renderer,
      buttonTemplate: view.buttonTemplate,
      archInfo,
    };
  },
};

registry.category("views").add("list", listView);
```

**Form** adds `Compiler: FormCompiler` and `searchMenuTypes: []`
(`addons/web/static/src/views/form/form_view.js`).

**Kanban** adds `Compiler: KanbanCompiler`
(`addons/web/static/src/views/kanban/kanban_view.js`).

## 3. The five (or six) pieces

### ArchParser

Plain class. Method: `parse(arch, relatedModels, resModel)` → `archInfo`. Called
synchronously inside `props`. Not an OWL component. Example:

```js
export class MyArchParser {
  parse(xmlDoc) {
    const imageField = xmlDoc.getAttribute("image_field");
    return {imageField};
  }
}
```

Source pattern: `addons/web/static/src/views/list/list_arch_parser.js` — and every
built-in view mirrors this.

### Model

Extends the abstract base `Model` from `addons/web/static/src/model/model.js`. A Model
owns data loading and exposes a `root` datapoint. It emits `"update"` on its `bus` to
trigger re-renders.

For CRUD views, use `RelationalModel` from
`@web/model/relational_model/relational_model`. For pure-display views (graph, calendar,
activity) ship your own Model class.

### Renderer

An OWL component. Receives the `model` (or `model.root`) via props (or via
`this.env.model` — the Controller puts it there via `useSubEnv`). Does not fetch;
delegates all mutation to datapoint methods (`record.update`, `list.load`, etc.).

### Controller

The root OWL component. Typically:

```js
import { useService } from "@web/core/utils/hooks";
import { Layout } from "@web/search/layout";
import { useModelWithSampleData } from "@web/model/model";

export class MyController extends Component {
    static template = "my_module.MyController";
    static components = { Layout, Renderer: /* Renderer */ };
    static props = { ...standardViewProps, Model: Function, Renderer: Function, archInfo: Object };

    setup() {
        this.model = useState(
            useModelWithSampleData(this.props.Model, this.modelParams, this.modelOptions)
        );
        useSubEnv({ model: this.model });
    }

    get modelParams() { return { /* config */ }; }
    get modelOptions() { return {}; }
}
```

Source pattern: `list_controller.js` (`useModelWithSampleData`) and `form_controller.js`
(`useModel` — no sample data).

### Compiler (optional)

Used by form and kanban to transpile arch fragments into OWL templates at runtime. Not
needed for custom views unless you want QWeb-style arch templates.

### Descriptor

The plain object registered into the views registry (see §2).

## 4. How a view is resolved at runtime

`View.loadView(props)` — `addons/web/static/src/views/view.js` lines 250–471:

1. `type` is validated against `session.view_info`; throws `Invalid view type: ${type}`
   otherwise.
2. If arch isn't inlined, `viewService.loadViews(...)` fetches it.
3. The XML's root node is inspected for `js_class`:

   ```js
   const jsClass = archXmlDoc.hasAttribute("js_class")
       ? archXmlDoc.getAttribute("js_class")
       : props.jsClass || type;
   if (!viewRegistry.contains(jsClass)) {
       await loadBundle(...);
   }
   const descr = viewRegistry.get(jsClass);
   ```

   Resolution order: `arch@js_class` → `props.jsClass` → `type`. If the key is missing,
   `web.assets_backend_lazy` (or its `_dark` variant) is loaded and the registry is
   checked again.

4. `descr.props(viewProps, descr, env.config)` produces the final controller props.
5. The Controller is rendered inside a `WithSearch` wrapper (template `web.View` in
   `addons/web/static/src/views/view.xml`):

   ```xml
   <t t-name="web.View">
       <WithSearch t-props="withSearchProps" t-slot-scope="search">
           <t t-component="Controller"
              t-on-click="handleActionLinks"
              t-props="componentProps"
              context="search.context"
              domain="search.domain"
              groupBy="search.groupBy"
              orderBy="search.orderBy"
              display="search.display"/>
       </WithSearch>
   </t>
   ```

### `session.view_info`

Server-side, `ir.ui.view.get_view_info` is called from `ir_http.py`. Source:
`addons/web/models/ir_http.py` line 128 and `addons/web/models/ir_ui_view.py`:

```python
def _get_view_info(self):
    return {
        'list':     {'icon': 'oi oi-view-list'},
        'form':     {'icon': 'fa fa-address-card', 'multi_record': False},
        'graph':    {'icon': 'fa fa-area-chart'},
        'pivot':    {'icon': 'oi oi-view-pivot'},
        'kanban':   {'icon': 'oi oi-view-kanban'},
        'calendar': {'icon': 'fa fa-calendar'},
        'search':   {'icon': 'oi oi-search'},
    }
```

**A new view type must override `_get_view_info` to add an icon entry**, otherwise the
JS registry validator rejects the type. See `references/view-registration.md` for the
full pattern.

## 5. Layout, ControlPanel, SearchPanel

Source: `addons/web/static/src/search/layout.js` and `layout.xml`.

```js
export function extractLayoutComponents(params) {
  return {
    ControlPanel: params.ControlPanel || ControlPanel,
    SearchPanel: params.SearchPanel || SearchPanel,
  };
}

export class Layout extends Component {
  static template = "web.Layout";
  static props = {
    className: {type: String, optional: true},
    display: {type: Object, optional: true},
    slots: {type: Object, optional: true},
  };
  setup() {
    this.components = extractLayoutComponents(this.env.config);
    this.contentRef = useRef("content");
  }
}
```

```xml
<t t-name="web.Layout">
    <t t-if="env.inDialog" t-portal="'#' + env.dialogId + ' .modal-footer'">
        <t t-slot="layout-buttons"/>
    </t>
    <t t-component="components.ControlPanel"
       slots="controlPanelSlots"
       t-if="props.display.controlPanel"
       display="props.display.controlPanel"/>
    <main t-ref="content" class="o_content" t-attf-class="{{props.className}}"
          t-att-class="{ 'o_component_with_search_panel': props.display.searchPanel }">
        <t t-component="components.SearchPanel" t-if="props.display.searchPanel"/>
        <t t-slot="default" contentRef="contentRef" />
    </main>
</t>
```

Typical Controller template:

```xml
<Layout className="props.className" display="display">
    <t t-set-slot="layout-buttons">
        <button class="btn btn-primary" t-on-click="onCreate">New</button>
    </t>
    <Renderer t-props="rendererProps"/>
</Layout>
```

Overriding the ControlPanel or SearchPanel: set `ControlPanel: MyPanel` or
`SearchPanel: MyPanel` on the registered view descriptor. `extractLayoutComponents` runs
on `env.config` (populated at `view.js` line 369).

## 6. `useModel` and lifecycle

Source: `addons/web/static/src/model/model.js`:

```js
export function useModel(ModelClass, params, options = {}) {
  const component = useComponent();
  const services = {};
  for (const key of ModelClass.services) {
    services[key] = useService(key);
  }
  services.orm = services.orm || useService("orm");
  const model = new ModelClass(component.env, params, services);
  onWillStart(async () => {
    await options.beforeFirstLoad?.();
    await model.load(getSearchParams(component.props));
    model.whenReady.resolve();
  });
  onWillUpdateProps((nextProps) => model.load(getSearchParams(nextProps)));
  return model;
}
```

`useModelWithSampleData` additionally supports the "sample data" UI for empty
lists/kanbans. Use `useModelWithSampleData` for list/kanban-style views, `useModel` for
form-style views.

Services the Model needs are declared on `ModelClass.services`.
`RelationalModel.services = ["action", "dialog", "notification", "orm"]`.

## 7. `RelationalModel` essentials

Source: `addons/web/static/src/model/relational_model/relational_model.js`.

```js
export class RelationalModel extends Model {
    static services = ["action", "dialog", "notification", "orm"];
    static Record = RelationalRecord;
    static Group = Group;
    static DynamicRecordList = DynamicRecordList;
    static DynamicGroupList = DynamicGroupList;
    static StaticList = StaticList;
    static DEFAULT_LIMIT = 80;
    static DEFAULT_COUNT_LIMIT = 10000;
    static DEFAULT_GROUP_LIMIT = 80;
    static DEFAULT_OPEN_GROUP_LIMIT = 10;
    static withCache = true;
    ...
}
```

The root datapoint is one of:

- `Record` — form view (mono-record).
- `DynamicGroupList` — when `groupBy` is non-empty (grouped list, kanban).
- `DynamicRecordList` — flat list / kanban.
- `StaticList` — sub-records of a x2many inside a record (not a root).

Hooks overridable by the Controller:

```js
{
    onWillLoadRoot,
    onRootLoaded,
    onWillSaveRecord,
    onRecordSaved,
    onWillSaveMulti,
    onSavedMulti,
    onWillSetInvalidField,
    onRecordChanged,
    onWillDisplayOnchangeWarning,
    onAskMultiSaveConfirmation,
}
```

### Writing values

Use `record.update({ field_name: value })`. It routes through the model mutex, triggers
onchange, and supports `{save: true}` to persist immediately. Never mutate `record.data`
directly.

Source: `addons/web/static/src/model/relational_model/record.js` lines 311–321.

### Reading values

`record.data[fieldName]` — `record` is a reactive proxy so reads register dependencies
with OWL reactivity.

## 8. Standard props contracts

### Controller props

Source: `addons/web/static/src/views/standard_view_props.js`.

```js
export const standardViewProps = {
  info: {type: Object},
  resModel: String,
  arch: {type: Element},
  className: {type: String, optional: true},
  context: {type: Object},
  createRecord: {type: Function, optional: true},
  display: {type: Object, optional: true},
  domain: {type: Array},
  fields: {type: Object},
  globalState: {type: Object, optional: true},
  groupBy: {type: Array, element: String},
  limit: {type: Number, optional: true},
  noBreadcrumbs: {type: Boolean, optional: true},
  orderBy: {type: Array, element: Object},
  relatedModels: {type: Object, optional: true},
  resId: {type: [Number, Boolean], optional: true},
  resIds: {type: Array, optional: true},
  searchMenuTypes: {type: Array, element: String},
  selectRecord: {type: Function, optional: true},
  state: {type: Object, optional: true},
  useSampleModel: {type: Boolean},
  updateActionState: {type: Function, optional: true},
};
```

A custom Controller should spread them:

```js
static props = { ...standardViewProps, Model: Function, Renderer: Function, archInfo: Object };
```

### Field widget props

Source: `addons/web/static/src/views/fields/standard_field_props.js`:

```js
export const standardFieldProps = {
  id: {type: String, optional: true},
  name: {type: String},
  readonly: {type: Boolean, optional: true},
  record: {type: Object},
};
```

### View widget props

Source: `addons/web/static/src/views/widgets/standard_widget_props.js`:

```js
export const standardWidgetProps = {
  readonly: {type: Boolean, optional: true},
  record: {type: Object},
};
```

## Key files (all on `odoo/odoo@19.0`)

- `addons/web/static/src/views/view.js` — the `View` component + registry validation.
- `addons/web/static/src/views/view.xml` — the `web.View` template.
- `addons/web/static/src/views/standard_view_props.js` — controller props.
- `addons/web/static/src/model/model.js` — `Model` base + `useModel` /
  `useModelWithSampleData`.
- `addons/web/static/src/model/relational_model/relational_model.js` —
  `RelationalModel`.
- `addons/web/static/src/model/relational_model/record.js` — `Record.update()`.
- `addons/web/static/src/search/layout.js` + `.xml` — `Layout`,
  `extractLayoutComponents`.
- `addons/web/static/src/views/list/list_view.js`, `form/form_view.js`,
  `kanban/kanban_view.js` — canonical descriptors.
- `addons/web/models/ir_ui_view.py` — `get_view_info` + `_get_view_info` (JS-visible
  type info).
- `odoo/addons/base/models/ir_ui_view.py` — `ir.ui.view.type` Selection.
- `odoo/addons/base/models/ir_actions.py` — `ir.actions.act_window.view` Selection.
- `addons/web/models/ir_http.py` — injects `view_info` into `session`.

## Uncertainties

- `js_class`: the 19.0 docs page for "view records" mentions this attribute but the
  fetched excerpts were partial. Behaviour is fully verified in `view.js` line 344 as
  quoted above.
- The exact pattern enterprise addons use to extend `ir.ui.view.type` in 19.0
  (`selection_add=[...]` on a `_inherit='ir.ui.view'` override) is the standard Odoo ORM
  pattern but was not verified against the private enterprise 19.0 source. For community
  code (`web_hierarchy`, `mail`) the pattern **is** verified.
- `Compiler` and `SearchModel` keys on the descriptor are listed as optional in §2
  because only some built-ins use them (`form`/`kanban` set `Compiler`; `graph`/`pivot`
  set `SearchModel`). The behaviour when omitted (default `Compiler` / `SearchModel`) is
  verified in `view.js` and `search_model.js`.
