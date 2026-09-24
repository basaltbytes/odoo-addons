# Odoo 19 Built-in Non-List/Non-Form Views

Every claim below is sourced from the Odoo 19.0 branch of `odoo/odoo`. When a root
attribute is listed, it is because the corresponding ArchParser reads it in the 19.0
source.

> **Verification status:** all views in this file are in the open-source repo and
> verified against `odoo/odoo@19.0`. Enterprise-only views are intentionally omitted
> from this skill.
>
> **Related references:**
>
> - [view-architecture.md](./view-architecture.md) — the descriptor + 5-piece model
>   these examples instantiate
> - [arch-xml.md](./arch-xml.md) — modifier syntax used in the arch examples
> - [view-registration.md](./view-registration.md) — how each addon registers itself
>   (Hierarchy and Activity follow this pattern)

## Which view type should I use?

| Use case                          | View        | Notes                                                                                        |
| --------------------------------- | ----------- | -------------------------------------------------------------------------------------------- | --- | ----------- |
| Cards in columns, drag-to-reorder | `kanban`    | Compiles arch into OWL templates; needs `<t t-name="card">`                                  |
| Bar/line/pie chart of aggregates  | `graph`     | Custom `Model` and `SearchModel`; no group-by in search menus until you add a group field    |
| Pivot table / cross-tab           | `pivot`     | Rows / cols / measures via `<field type="row                                                 | col | measure"/>` |
| Date events on a calendar         | `calendar`  | Custom `Model`; needs `date_start`; excludes group-by from search                            |
| Activity timeline (mail.activity) | `activity`  | Community in `mail`; mostly driven by activity-type records                                  |
| Tree / parent-child layouts       | `hierarchy` | Community in `web_hierarchy`; the cleanest reference for adding a new view type from scratch |
| Filters / facets / search panel   | `search`    | Not a standalone view — embedded into every other view via `WithSearch`                      |
| QWeb-rendered template            | `qweb`      | Used by website/reporting; not a data-display view                                           |

## Table of contents

1. Kanban (`<kanban>`)
2. Graph (`<graph>`)
3. Pivot (`<pivot>`)
4. Calendar (`<calendar>`)
5. Activity (`<activity>`) — community, in `mail`
6. Hierarchy (`<hierarchy>`) — community, in `web_hierarchy`
7. Search (`<search>`)
8. QWeb (`<qweb>`)

---

## 1. Kanban

**Files:** `addons/web/static/src/views/kanban/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/web/static/src/views/kanban

**Descriptor (`kanban_view.js`):**

```js
export const kanbanView = {
  type: "kanban",
  ArchParser: KanbanArchParser,
  Controller: KanbanController,
  Model: RelationalModel,
  Renderer: KanbanRenderer,
  Compiler: KanbanCompiler,
  buttonTemplate: "web.KanbanView.Buttons",
  props: (genericProps, view) => {
    /* parses arch */
  },
};
registry.category("views").add("kanban", kanbanView);
```

**Root `<kanban>` attributes** (from `kanban_arch_parser.js`):

- `class`, `js_class`
- `can_open`, `default_order`, `limit`, `count_limit`
- `records_draggable`, `groups_draggable`
- `archivable`, `group_create`, `group_delete`, `group_edit`
- `quick_create`, `quick_create_view`
- `default_group_by` (comma-separated)
- `on_create`, `action`, `type` (`action`/`type` combine into an `openAction`)
- `highlight_color` (card color field)

**Required child:** `<templates><t t-name="card">...</t></templates>`. Optional:
`<t t-name="menu">` for per-record cog menu. Constants:

```js
export const KANBAN_CARD_ATTRIBUTE = "card";
export const KANBAN_MENU_ATTRIBUTE = "menu";
```

Odoo 18+ renamed `<t t-name="kanban-box">` to `<t t-name="card">`. The parser raises
"Missing 'card' template" if absent.

**Minimal arch:**

```xml
<kanban default_group_by="state" records_draggable="1" quick_create="1">
    <field name="state"/>
    <templates>
        <t t-name="card">
            <div class="o_kanban_record_header">
                <strong><field name="name"/></strong>
            </div>
            <div class="o_kanban_record_body">
                <field name="partner_id"/>
            </div>
            <t t-name="menu">
                <a role="menuitem" type="edit">Edit</a>
                <a role="menuitem" type="delete">Delete</a>
            </t>
        </t>
    </templates>
</kanban>
```

## 2. Graph

**Files:** `addons/web/static/src/views/graph/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/web/static/src/views/graph

**Descriptor:**

```js
export const graphView = {
    type: "graph",
    ArchParser: GraphArchParser,
    Controller: GraphController,
    Renderer: GraphRenderer,
    Model: GraphModel,
    SearchModel: GraphSearchModel,
    searchMenuTypes: ["filter", "groupBy", "favorite"],
    buttonTemplate: "web.GraphView.Buttons",
    props: (...) => { ... },
};
```

> **Note on the custom Model:** Graph uses `GraphModel` (not `RelationalModel`) and
> `GraphSearchModel`. This is by design — graphs aggregate rather than list records, so
> the model's `root` exposes aggregated buckets, not record datapoints. If you write a
> `js_class` for `graph`, your overrides will see this Model — don't expect
> `record.update()` semantics.

**Root `<graph>` attributes:**

- `type` — `bar` | `line` | `pie` (default: `bar`)
- `order` — `ASC` | `DESC` | `asc` | `desc`
- `string` — title
- `disable_linking` — boolean
- `stacked` — boolean (default `true`)
- `cumulated` — boolean
- `cumulated_start` — boolean

**Child `<field>` attributes:**

- `name` (required)
- `type` — `"measure"` (anything else = group-by)
- `string`
- `widget`
- `invisible` (`"True"` or `"1"` drops the node)
- `interval` — for date grouping: `day`, `week`, `month`, `quarter`, `year`

**Minimal arch:**

```xml
<graph type="bar" stacked="1" string="Sales by Month">
    <field name="order_date" interval="month"/>
    <field name="partner_id"/>
    <field name="amount_total" type="measure"/>
</graph>
```

## 3. Pivot

**Files:** `addons/web/static/src/views/pivot/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/web/static/src/views/pivot

**Descriptor:**

```js
export const pivotView = {
    type: "pivot",
    ArchParser: PivotArchParser,
    Controller: PivotController,
    Renderer: PivotRenderer,
    Model: PivotModel,
    SearchModel: PivotSearchModel,
    searchMenuTypes: ["filter", "groupBy", "favorite"],
    buttonTemplate: "web.PivotView.Buttons",
    props: (...) => { ... },
};
```

**Root `<pivot>` attributes:**

- `disable_linking` — boolean expression
- `default_order` — order spec
- `string` — title
- `display_quantity` — boolean

**Child `<field>` attributes:**

- `name` (required)
- `type` — `"row"` | `"col"` | `"measure"`
- `string`, `widget`, `invisible`, `interval`, `operator`
- `options` (py.js)

A default measure of `__count` is injected by `pivot_view.js` if none is active.

**Minimal arch:**

```xml
<pivot string="Sales report">
    <field name="partner_id" type="row"/>
    <field name="order_date" type="col" interval="month"/>
    <field name="amount_total" type="measure"/>
</pivot>
```

## 4. Calendar

**Files:** `addons/web/static/src/views/calendar/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/web/static/src/views/calendar

**Descriptor (`calendar_view.js`):**

```js
export const calendarView = {
    type: "calendar",
    searchMenuTypes: ["filter", "favorite"],       // no groupBy
    ArchParser: CalendarArchParser,
    Controller: CalendarController,
    Model: CalendarModel,
    Renderer: CalendarRenderer,
    buttonTemplate: "web.CalendarController.controlButtons",
    props: (...) => { ... },
};
```

> **Note on the custom Model:** Calendar uses `CalendarModel` (not `RelationalModel`).
> Its `root` exposes calendar-specific structures (events, ranges, filters) rather than
> a flat record list. The `searchMenuTypes` deliberately omits `"groupBy"` because
> calendar events are inherently grouped by date — adding another groupBy would be
> redundant.

**Root `<calendar>` attributes** (from `calendar_arch_parser.js`):

Date/time:

- `date_start` — **required**, the datetime field where events start
- `date_stop` — datetime field where events end
- `date_delay` — numeric field for duration instead of `date_stop`
- `all_day` — boolean field for all-day events

Display:

- `mode` — `day` | `week` | `month` | `year`
- `scales` — comma-separated list of available scales
- `color` — name of a field used to color events
- `hide_date` — boolean
- `hide_time` — boolean
- `event_limit` — number (default 5)
- `month_overflow` — boolean (default `true`)
- `show_date_picker` — boolean (default `true`)
- `show_unusual_days` — boolean

Actions:

- `create` — boolean (default `true`)
- `edit` — boolean (default `true`)
- `delete` — boolean (default `true`)
- `quick_create` — boolean (default `true`)
- `quick_create_view_id` — reference to a quick-create form view
- `multi_create_view` — reference to a multi-create view
- `event_open_popup` — boolean

Misc:

- `form_view_id` — opens this form view for full edit
- `js_class`
- `aggregate` — `"field:operation"` pattern

**Child `<field>` attributes:**

- `name`
- `avatar_field`
- `filters`, `filter_field`
- `color`
- `write_field`, `write_model`

**Minimal arch:**

```xml
<calendar date_start="start_datetime"
          date_stop="stop_datetime"
          mode="month"
          color="partner_id"
          quick_create="1">
    <field name="name"/>
    <field name="partner_id" filters="1"/>
</calendar>
```

## 5. Activity

**Files:** `addons/mail/static/src/views/web/activity/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/mail/static/src/views/web/activity

Community-shipped in `mail`. The type is added by `mail` via `_inherit = 'ir.ui.view'` +
`selection_add=[('activity', 'Activity')]`.

**Descriptor (`activity_view.js`):**

```js
export const activityView = {
    type: "activity",
    searchMenuTypes: ["filter", "favorite"],
    ArchParser: ActivityArchParser,
    Controller: ActivityController,
    Renderer: ActivityRenderer,
    Model: ActivityModel,
    props: (...) => { ... },
};
registry.category("views").add("activity", activityView);
```

**Root `<activity>` attributes** (from `activity_arch_parser.js`): very few —
`js_class`, `string`. The view is largely driven by the registered `mail.activity.type`
records.

**Children:** `<field name="...">` (for tooltip/display fields) and `<templates>` with
`<t t-name="...">` for card styling.

**Minimal arch:**

```xml
<activity string="Activities on Partners">
    <field name="name"/>
    <templates>
        <div t-name="activity-box">
            <field name="name"/>
        </div>
    </templates>
</activity>
```

## 6. Hierarchy

**Files:** `addons/web_hierarchy/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/web_hierarchy

Community-shipped in 19.0 (moved from enterprise).

**Client-side descriptor:** `addons/web_hierarchy/static/src/hierarchy_view.js`
registers a view of the same shape as `kanbanView` —
`{type: "hierarchy", ArchParser, Controller, Renderer, Model, Compiler}`. Read that file
for the canonical custom-view-from-scratch example.

**Server-side registration (`addons/web_hierarchy/models/ir_ui_view.py`):**

```python
HIERARCHY_VALID_ATTRIBUTES = {
    '__validate__', 'class', 'js_class', 'string',
    'create', 'edit', 'delete',
    'parent_field', 'child_field', 'icon', 'draggable', 'default_order'
}

class IrUiView(models.Model):
    _inherit = 'ir.ui.view'
    type = fields.Selection(selection_add=[('hierarchy', "Hierarchy")])

    def _is_qweb_based_view(self, view_type):
        return super()._is_qweb_based_view(view_type) or view_type == "hierarchy"

    def _get_view_info(self):
        return {'hierarchy': {'icon': 'fa fa-share-alt fa-rotate-90'}} | super()._get_view_info()
```

**Root `<hierarchy>` attributes** (verified set):

- `class`, `js_class`, `string`
- `create`, `edit`, `delete`
- `parent_field`, `child_field`
- `icon`, `draggable`, `default_order`

**Children:** `<field>` and **one** `<templates>` (enforced server-side).

**Minimal arch:**

```xml
<hierarchy parent_field="parent_id" child_field="child_ids" draggable="1">
    <field name="name"/>
    <templates>
        <t t-name="hierarchy-box">
            <div class="o_hierarchy_box">
                <strong><field name="name"/></strong>
            </div>
        </t>
    </templates>
</hierarchy>
```

This is the **best community-source reference** for how to add a brand-new view type
from scratch — go read the whole module.

## 7. Search

**Files:** `addons/web/static/src/search/` URL:
https://github.com/odoo/odoo/tree/19.0/addons/web/static/src/search

> **Special case:** `<search>` is not a "view type" in the Controller/Renderer sense.
> It's a meta-arch embedded in every other view's `Layout` via `WithSearch`. There is no
> descriptor to register and no `Model`/`Renderer` swap. What this section documents is
> the **XML syntax accepted inside a `<search>` arch**, parsed by
> `search_arch_parser.js`.

**Root `<search>` attributes:** none parsed (the wrapper has no behaviour of its own).

**Child elements** (from `search_arch_parser.js`):

### `<field>` — search field

- `name` (required), `string`, `invisible`, `domain`, `filter_domain`, `operator`
  (`ilike`/`=`/…), `context`, `widget`

### `<filter>` — predefined filter

- `name`, `string`, `domain` (default `"[]"`), `context` (may carry `group_by`),
  `invisible`, `help`
- `date`, `start_year`, `end_year`, `start_month`, `end_month`, `default_period`
  (comma-separated)

### `<group>` — visual grouping of filters/fields

### `<separator>` — visual break in the dropdown

### `<searchpanel>` — left-side faceted filters

- Root: `class`, `view_types` (comma-separated list of view types where the panel is
  active)
- Children are `<field name="…"/>` elements:
  - **Category** (no `select` attribute): `name`, `string`, `color`, `icon`,
    `enable_counters`, `expand`, `hierarchize`, `depth`, `domain`, `limit`, `invisible`
  - **Filter** (`select="multi"`): all the above + `groupby` for sub-grouping

**Minimal arch:**

```xml
<search>
    <field name="name"/>
    <field name="partner_id"/>
    <filter name="my_records" string="My records" domain="[('user_id', '=', uid)]"/>
    <separator/>
    <filter name="done" string="Done" domain="[('state', '=', 'done')]"/>
    <group string="Group by">
        <filter name="group_by_user" string="User" context="{'group_by': 'user_id'}"/>
    </group>
    <searchpanel>
        <field name="category_id" icon="fa-tags" enable_counters="1"/>
        <field name="tag_ids" select="multi" groupby="group_id"/>
    </searchpanel>
</search>
```

## 8. QWeb

The `qweb` view type exists in the `ir.ui.view.type` Selection but is used for **website
/ reporting templates**, not a data-display view. There is no JS descriptor in
`registry.category("views")` for `qweb` — the type exists so that `ir.ui.view` records
storing reporting/website templates pass server-side validation.

```xml
<!-- Minimal qweb arch -->
<t t-name="my_module.report_partner">
    <t t-call="web.html_container">
        <t t-call="web.external_layout">
            <t t-foreach="docs" t-as="o">
                <h2 t-field="o.name"/>
            </t>
        </t>
    </t>
</t>
```

Out of scope for this skill — see Odoo's
[QWeb reports](https://www.odoo.com/documentation/19.0/developer/reference/backend/reports.html)
docs for full reference.
