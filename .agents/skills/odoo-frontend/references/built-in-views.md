# Odoo 19 Built-In Views

Use this to choose or customize built-in Odoo 19 view archs. Enterprise-only views are intentionally omitted because their 19.0 source is private.

## Table of Contents

1. Choosing a view
2. Kanban
3. Graph and pivot
4. Calendar
5. Activity and hierarchy
6. Search and QWeb
7. Source anchors

## 1. Choosing a View

| Use case | View | Notes |
| --- | --- | --- |
| Cards, stages, drag/drop | `kanban` | Requires `<templates><t t-name="card">...` |
| Aggregate chart | `graph` | Custom aggregate model; no `record.update` semantics |
| Cross-tab analysis | `pivot` | Rows, columns, measures declared with `<field type=...>` |
| Date events | `calendar` | Requires `date_start`; custom calendar model |
| Mail activity overview | `activity` | Added by `mail`; activity-type driven |
| Parent/child tree | `hierarchy` | Added by `web_hierarchy`; good custom-view reference |
| Filters/facets/search panel | `search` | Embedded through `WithSearch`, not a normal renderer view |
| Website/report template | `qweb` | Server-side template type, not a JS data-display view |

## 2. Kanban

Root attributes commonly read by the parser:

- `class`, `js_class`, `default_order`, `default_group_by`, `limit`, `count_limit`
- `records_draggable`, `groups_draggable`
- `archivable`, `group_create`, `group_delete`, `group_edit`
- `quick_create`, `quick_create_view`
- `can_open`, `on_create`, `action`, `type`, `highlight_color`

Required template in Odoo 18+ / 19:

```xml
<kanban default_group_by="state">
    <field name="state"/>
    <templates>
        <t t-name="card">
            <strong><field name="name"/></strong>
        </t>
    </templates>
</kanban>
```

Do not use old `<t t-name="kanban-box">`; Odoo 19 expects `card`.

## 3. Graph and Pivot

Both use custom aggregate models and search models, not `RelationalModel` record lists.

Graph root attributes:

- `type`: `bar`, `line`, or `pie`
- `order`, `string`, `disable_linking`, `stacked`, `cumulated`, `cumulated_start`

Graph fields:

```xml
<graph type="bar" stacked="1" string="Sales by Month">
    <field name="order_date" interval="month"/>
    <field name="partner_id"/>
    <field name="amount_total" type="measure"/>
</graph>
```

Pivot root attributes:

- `disable_linking`, `default_order`, `string`, `display_quantity`

Pivot fields:

```xml
<pivot string="Sales report">
    <field name="partner_id" type="row"/>
    <field name="order_date" type="col" interval="month"/>
    <field name="amount_total" type="measure"/>
</pivot>
```

Field attributes shared by graph/pivot include `name`, `type`, `string`, `widget`, `invisible`, `interval`, and measure/operator-specific values. Pivot injects `__count` if no active measure exists.

## 4. Calendar

Calendar uses `CalendarModel` and omits `groupBy` from search menus.

Important root attributes:

- Required: `date_start`
- Date fields: `date_stop`, `date_delay`, `all_day`
- Display: `mode`, `scales`, `color`, `hide_date`, `hide_time`, `event_limit`, `month_overflow`, `show_date_picker`, `show_unusual_days`
- Actions: `create`, `edit`, `delete`, `quick_create`, `quick_create_view_id`, `multi_create_view`, `event_open_popup`
- Other: `form_view_id`, `js_class`, `aggregate`

```xml
<calendar date_start="start_datetime"
          date_stop="stop_datetime"
          mode="month"
          color="partner_id">
    <field name="name"/>
    <field name="partner_id" filters="1"/>
</calendar>
```

Child fields may use `avatar_field`, `filters`, `filter_field`, `color`, `write_field`, and `write_model`.

## 5. Activity and Hierarchy

`activity` is added by the `mail` module. It accepts little root configuration (`js_class`, `string`) and is mostly driven by `mail.activity.type` data.

```xml
<activity string="Partner Activities">
    <field name="name"/>
    <templates>
        <div t-name="activity-box"><field name="name"/></div>
    </templates>
</activity>
```

`hierarchy` is added by `web_hierarchy` and is the best community source for a full custom view type. Root attributes include `class`, `js_class`, `string`, `create`, `edit`, `delete`, `parent_field`, `child_field`, `icon`, `draggable`, and `default_order`.

```xml
<hierarchy parent_field="parent_id" child_field="child_ids" draggable="1">
    <field name="name"/>
    <templates>
        <t t-name="hierarchy-box"><strong><field name="name"/></strong></t>
    </templates>
</hierarchy>
```

## 6. Search and QWeb

`search` is parsed by the search framework and embedded into other views through `WithSearch`. Important children:

- `<field>`: `name`, `string`, `domain`, `filter_domain`, `operator`, `context`, `widget`, `invisible`
- `<filter>`: `name`, `string`, `domain`, `context`, date period attrs, `help`, `invisible`
- `<group>` and `<separator>`: visual organization
- `<searchpanel>` with child `<field>` categories or `select="multi"` filters

`qweb` exists in `ir.ui.view.type` for website/report templates. There is no normal JS descriptor in `registry.category("views")`; use backend QWeb report references for reports.

## 7. Source Anchors

- `addons/web/static/src/views/kanban/`
- `addons/web/static/src/views/graph/`
- `addons/web/static/src/views/pivot/`
- `addons/web/static/src/views/calendar/`
- `addons/mail/static/src/views/web/activity/`
- `addons/web_hierarchy/`
- `addons/web/static/src/search/`
