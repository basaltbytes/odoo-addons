---
name: advanced-kanban-customization
description: Tutorial-derived patterns for extending kanban views with `js_class`, template inheritance, `searchModel`, side panels, `t-model`, fuzzy filtering, and pager coordination.
---

# Advanced Kanban Customization

Use this when you need a list-plus-kanban hybrid, a sidebar next to a built-in view, or any `js_class` customization that must cooperate with the real search model.

## Extend the stock view; do not fork it

Start from `kanbanView` and override only the controller or renderer you need:

```js
import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { AwesomeKanbanController } from "./awesome_kanban_controller";

registry.category("views").add("awesome_kanban", {
    ...kanbanView,
    Controller: AwesomeKanbanController,
});
```

Then attach it from XML with `js_class`:

```xml
<xpath expr="//kanban" position="attributes">
    <attribute name="js_class">awesome_kanban</attribute>
</xpath>
```

This keeps search, control panel, buttons, and future kanban fixes unless you explicitly replace them.

## Controller-only overrides are enough for passive refresh

The solved shelter addon shows the smallest useful `js_class` customization: override only the Controller and call `this.model.load()` on a timer.

```js
class ShelterKanbanController extends kanbanView.Controller {
    setup() {
        super.setup();
        useInterval(this.reload.bind(this), 10000);
    }

    reload() {
        this.model.load();
    }
}
```

If the stock renderer and search behavior are already correct, this is enough. You do not need a custom renderer or template just to refresh records periodically.

## Insert side content by inheriting the controller template

The tutorial's clean pattern is to extend `web.KanbanView` and insert your sidebar before the renderer slot, not to rewrite the whole controller template.

```xml
<t t-name="my_module.KanbanView" t-inherit="web.KanbanView">
    <xpath expr="//t[@t-component='props.Renderer']" position="before">
        <CustomerList selectCustomer.bind="selectCustomer"/>
    </xpath>
</t>
```

That keeps the stock renderer dynamic and leaves room for later renderer swaps.

## Write real filters through `env.searchModel`

A sidebar click should create or toggle real search items, not mutate some private domain state.

```js
const CUSTOMER_FILTER = Symbol("customer_filter");

selectCustomer(partner) {
    for (const item of this.env.searchModel.getSearchItems((candidate) => candidate[CUSTOMER_FILTER])) {
        if (item.isActive) {
            this.env.searchModel.toggleSearchItem(item.id);
        }
    }
    this.env.searchModel.createNewFilters([{
        description: partner.name,
        domain: [["partner_id", "=", partner.id]],
        [CUSTOMER_FILTER]: true,
    }]);
}
```

Two caveats from the tutorial matter:

- `createNewFilters(...)` adds filters; it does not replace your previous one.
- use a `Symbol` marker instead of a string flag when tagging custom search items, so addon metadata does not collide.

## Keep sidebar input state local and declarative

For a small local UI such as `Active customers` plus a search box, the maintainable shape is:

- load the base record set once in the side component;
- keep checkbox and text input state in `useState(...)`;
- bind inputs with `t-model`;
- expose a `displayedCustomers` getter that applies local filters.

This is cleaner than stacking manual `t-on-input` handlers across the template.

`fuzzyLookup` from `@web/core/utils/search` is the tutorial's recommended helper when a plain `includes(...)` match feels too rigid.

## Pager caveat: decide whether filtering is client-side or server-side

The tutorial explicitly calls this out as the hardest part. Once you mix:

- server paging,
- client-side fuzzy filtering,
- and "only active customers" filtering,

you need one deliberate source of truth.

Use one of these designs:

- load the full sidebar dataset client-side, then filter and paginate locally;
- or move filtering and paging to the server and make the sidebar state drive the ORM query.

Do not fetch one page from the server and then pretend a client-side filter is global; that produces missing or unstable results.
