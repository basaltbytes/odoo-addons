# Example: Optimising a large list

Sources: `reactivity.md`, `event_handling.md`, `templates.md`.

The three levers that cover almost every slow list render, in order of impact:

1. `t-key` with an **intrinsic id** so reconciliation can move nodes instead of rebuilding them.
2. `t-on-*.synthetic` for row-level handlers.
3. `markRaw` on items when items are effectively immutable and the list is very large.

## Step 0 — the slow baseline

```js
import { Component, useState, xml } from "@odoo/owl";

class BigList extends Component {
  static template = xml`
    <ul>
      <t t-foreach="items" t-as="item">
        <li t-on-click="() => select(item.id)">
          <t t-esc="item.label"/>: <t t-esc="item.value"/>
        </li>
      </t>
    </ul>`;

  setup() {
    this.items = useState(buildBigArray());   // e.g. 2000 items
  }

  select(id) { /* ... */ }
}
```

Four problems:

- No `t-key` → OWL uses the index. Inserting at the front of the list rebuilds every row.
- Every `<li>` gets its own click listener.
- Every item is a Proxy. Reading 2000 × (`label`, `value`) during a render creates a lot of subscription work.
- An inline arrow lambda as `t-on-click` captures a changing `item` → forced re-render per row every parent render.

## Step 1 — stable `t-key`

```xml
<t t-foreach="items" t-as="item" t-key="item.id">
  <li t-on-click="() => select(item.id)">
    <t t-esc="item.label"/>: <t t-esc="item.value"/>
  </li>
</t>
```

Choose the key from an intrinsic id that doesn't change as the list is manipulated. A primary key from the server, a UUID, a monotonic counter — all fine. The index is only fine for append-only lists.

Remember: objects don't work as keys (they become `"[object Object]"`).

## Step 2 — switch to synthetic events

```xml
<li t-on-click.synthetic="() => select(item.id)">
```

The doc's guarantee: _"it actually adds only one handler on the document body, and will properly call the handler, just as expected."_ Limit: the event can no longer be stopped before it reaches `document.body`.

If you need `stopPropagation` earlier, keep a regular handler on that specific row but keep most others synthetic.

## Step 3 — stop reconstructing the handler reference

Even a stable row benefits if the handler itself is stable. With an inline arrow, every parent render creates a new function per row. Move to a parent-level method + a `data-*` attribute to read the id:

```xml
<ul t-on-click.synthetic="onItemClick">
  <t t-foreach="items" t-as="item" t-key="item.id">
    <li t-att-data-id="item.id">
      <t t-esc="item.label"/>: <t t-esc="item.value"/>
    </li>
  </t>
</ul>
```

```js
onItemClick(ev) {
  const li = ev.target.closest("li[data-id]");
  if (!li) return;
  this.select(Number(li.dataset.id));
}
```

Now there is exactly one listener, and zero function allocations per row.

## Step 4 — `markRaw` when items are immutable

When items never change (static reference data, search results, log rows), wrap them with `markRaw` so OWL does not create per-item proxies:

```js
import { markRaw, useState } from "@odoo/owl";

this.items = useState(
  buildBigArray().map((item) => markRaw(item))
);
```

Or in the `reactivity.md` example:

```js
this.items = useState([
  markRaw({ label: "some text", value: 42 }),
  // ... 1000 total objects
]);
```

Trade-off, straight from the doc:

```js
// Adding a new item → fine (the array is still reactive)
this.items.push(markRaw({ label: "another", value: 1337 }));

// Editing an item's field → NO re-render happens
this.items[17].value = 3;
```

If an item really needs to change, replace the whole entry with a new `markRaw` wrapper:

```js
this.items.splice(17, 1, markRaw({ ...this.items[17], value: 3 }));
```

## Step 5 — avoid wholesale reads during renders

Don't write things like this in a template:

```xml
<p><t t-esc="JSON.stringify(state)"/></p>
```

That reads every key and over-subscribes the component. Read only what you render.

Similarly, avoid destructuring the whole state in `setup`:

```js
// Bad — subscribes to every key
const { a, b, c, d, e } = this.state;
```

Just dereference lazily in the template or in the methods that actually use each key.

## Step 6 — keep mutation batched

If a single user interaction fans out into many writes, wrap the operation in a helper that keeps the writes together — OWL already batches to one render per animation frame, but you can reduce intermediate re-reads by computing the new state eagerly and assigning once.

For store-side callbacks (e.g. save-to-localStorage), use `batched(fn)` so a burst of writes in one tick triggers a single callback (see `utils.md`).

## Final optimised list

```js
import { Component, useState, markRaw, xml } from "@odoo/owl";

class BigList extends Component {
  static template = xml`
    <ul t-on-click.synthetic="onItemClick">
      <t t-foreach="items" t-as="item" t-key="item.id">
        <li t-att-data-id="item.id">
          <t t-esc="item.label"/>: <t t-esc="item.value"/>
        </li>
      </t>
    </ul>`;

  setup() {
    const raw = buildBigArray().map((i) => markRaw(i));
    this.items = useState(raw);
  }

  onItemClick(ev) {
    const li = ev.target.closest("li[data-id]");
    if (!li) return;
    this.select(Number(li.dataset.id));
  }

  select(id) { /* ... */ }
}
```

A canonical "1000 items fast" setup. Profile before adding more optimisations — virtualising (only rendering what's visible) is the next step if the list is truly huge, and that's usually delivered by a component library or the view layer rather than OWL primitives.
