# Slots

Source: `slots.md`.

Slots let a component expose a "hole" where the parent can inject content. OWL slots support unnamed (default) slots, named slots, default content, dynamic slot selection, and scoped slots with per-slot props.

## Default slot

```xml
<!-- parent -->
<div>
  <Navbar>
    <span>Hello Owl</span>
  </Navbar>
</div>
```

```xml
<!-- Navbar template -->
<div class="navbar">
  <t t-slot="default"/>
  <ul>
    <!-- rest of the navbar -->
  </ul>
</div>
```

> _"All elements inside the component which are not a named slot will be treated as part of the content of the `default` slot."_

## Named slots

Named slots are defined by the child with `<t t-slot="title"/>` and filled by the parent with `<t t-set-slot="title">…</t>`:

```xml
<!-- InfoBox template -->
<div class="info-box">
  <div class="info-box-title">
    <t t-slot="title"/>
    <span class="info-box-close-button" t-on-click="close">X</span>
  </div>
  <div class="info-box-content">
    <t t-slot="content"/>
  </div>
</div>
```

```xml
<!-- parent usage -->
<InfoBox>
  <t t-set-slot="title">
    Specific Title. It could be html also.
  </t>
  <t t-set-slot="content">
    <!-- some template here, with html, events, whatever -->
  </t>
</InfoBox>
```

You can mix the default slot with named slots in the same call:

```xml
<div>
  <Child>
    default content
    <t t-set-slot="footer">
      content for footer slot here
    </t>
  </Child>
</div>
```

Note: OWL 2 no longer uses `t-set` to define slot content — it must be `t-set-slot` (see CHANGELOG).

## Default content (fallback)

A `<t t-slot="x">…</t>` with children provides fallback content used when the parent doesn't fill that slot:

```xml
<!-- parent -->
<div t-name="Parent">
  <Child/>
</div>

<!-- Child -->
<span t-name="Child">
  <t t-slot="default">default content</t>
</span>

<!-- renders: <div><span>default content</span></div> -->
```

## Rendering context — the single most important rule

> _"The content of the slots is actually rendered with the rendering context corresponding to where it was defined, not where it is positioned. This allows the user to define event handlers that will be bound to the correct component (usually, the grandparent of the slot content)."_ (`slots.md`)

Practically: inside the slot content you write, `this` refers to the **parent** (where the slot content was authored), not the child that renders the slot. That is why `t-on-click="parentMethod"` works naturally from inside a slot.

## Slot props (parameters)

Slots can receive their own props just like components — and the same suffixes (`.bind`, `.translate`, …) work on them:

```xml
<!-- Notebook component -->
<div class="notebook">
  <div class="tabs">
    <t t-foreach="tabNames" t-as="tab" t-key="tab_index">
      <span t-att-class="{active:tab_index === activeTab}"
            t-on-click="() => state.activeTab = tab_index">
        <t t-esc="props.slots[tab].title"/>
      </span>
    </t>
  </div>
  <div class="page">
    <t t-slot="{{currentSlot}}"/>
  </div>
</div>
```

```js
class Notebook extends Component {
  setup() {
    this.state = useState({ activeTab: 0 });
    this.tabNames = Object.keys(this.props.slots);
  }

  get currentSlot() {
    return this.tabNames[this.state.activeTab];
  }
}
```

```xml
<!-- Usage -->
<Notebook>
  <t t-set-slot="page1" title.translate="Page 1">
    <div>this is in the page 1</div>
  </t>
  <t t-set-slot="page2" title.translate="Page 2" hidden="somevalue">
    <div>this is in the page 2</div>
  </t>
</Notebook>
```

The `title.translate="Page 1"` attribute is a per-slot translatable prop.

## Dynamic slots

A slot name can be computed:

```xml
<t t-slot="{{current}}"/>
```

## The `slots` meta-prop

OWL exposes the slot information as a special prop:

```js
{ slotName_1: slotInfo_1, ..., slotName_m: slotInfo_m }
```

This makes it easy to pass slots through to a nested component:

```xml
<Child slots="props.slots"/>
```

If your component declares `static props` and also uses slots, remember to whitelist `slots`:

```js
static props = ["someProp", "slots?"];
```

(See `05_props.md` for rules.)

## Scoped slots — `t-slot-scope`

Children can provide values back to slot content. The parent receives them via `t-slot-scope`:

```xml
<!-- parent -->
<MyComponent>
  <t t-set-slot="foo" t-slot-scope="scope">
    content
    <t t-esc="scope.bool"/>
    <t t-esc="scope.num"/>
  </t>
</MyComponent>
```

```xml
<!-- child provides the values when rendering the slot -->
<t t-slot="foo" bool="other_var" num="5"/>
```

Alternative forms:

```xml
<!-- pass an object -->
<t t-slot="foo" t-props="someObject"/>
```

```xml
<!-- shortcut on the default slot -->
<MyComponent t-slot-scope="scope">
  content
  <t t-esc="scope.bool"/>
  <t t-esc="scope.num"/>
</MyComponent>
```

> _"Slot values works like normal props, so one can use the `.bind` suffix to bind a function if needed."_

## Patterns that use slots

- **ErrorBoundary** — see `10_errors_testing.md`. A wrapper that shows a fallback slot when an error occurs in the default slot.
- **Layouts** — a generic component that exposes named slots for header / content / footer.
- **Tab containers (Notebook)** — the example above. The slot's per-tab title and visibility are driven by slot props.
- **Generic containers** — `Card`, `Panel`, `Modal`: the consumer injects its own content.

See `examples/slots_notebook.md` for a minimally-complete runnable version.
