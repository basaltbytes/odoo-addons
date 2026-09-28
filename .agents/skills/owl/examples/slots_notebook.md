# Example: Slots — default, named, dynamic, scoped

Source: `slots.md`.

## 1. Default slot — a Card component

```js
import { Component, xml } from "@odoo/owl";

export class Card extends Component {
  static template = xml`
    <div class="card">
      <div class="card-body">
        <h5 class="card-title" t-esc="props.title"/>
        <div class="card-text">
          <t t-slot="default"/>
        </div>
      </div>
    </div>`;

  static props = { title: String, slots: { type: Object, optional: true } };
}
```

Usage:

```xml
<Card title="'Notes'">
  <p>Hello from the default slot</p>
</Card>
```

Content between `<Card>` and `</Card>` that is not a `<t t-set-slot="...">` goes into the default slot.

## 2. Named slots — InfoBox

```js
export class InfoBox extends Component {
  static template = xml`
    <div class="info-box">
      <div class="info-box-title">
        <t t-slot="title"/>
        <span class="info-box-close-button" t-on-click.bind="props.onClose">X</span>
      </div>
      <div class="info-box-content">
        <t t-slot="content"/>
      </div>
    </div>`;

  static props = {
    onClose: { type: Function, optional: true },
    slots: { type: Object, optional: true },
  };
}
```

Usage:

```xml
<InfoBox onClose.bind="dismiss">
  <t t-set-slot="title">
    Specific title — can be html
  </t>
  <t t-set-slot="content">
    <p>arbitrary content with <strong>events</strong> and all.</p>
    <button t-on-click="clickMe">click</button>
  </t>
</InfoBox>
```

Slot content is rendered in the **parent's** context, so `t-on-click="clickMe"` calls `clickMe` on the parent, not `InfoBox`.

## 3. Default content (fallback when the slot isn't filled)

```xml
<div class="card">
  <t t-slot="footer">
    <small class="muted">No footer provided</small>
  </t>
</div>
```

If the user of `Card` does not supply `<t t-set-slot="footer">...</t>`, the fallback renders.

## 4. Dynamic slots — a Notebook with tabs

```js
import { Component, useState, xml } from "@odoo/owl";

export class Notebook extends Component {
  static template = xml`
    <div class="notebook">
      <div class="tabs">
        <t t-foreach="tabNames" t-as="tab" t-key="tab">
          <span t-att-class="{active: tab === state.activeTab}"
                t-on-click="() => state.activeTab = tab">
            <t t-esc="props.slots[tab].title"/>
          </span>
        </t>
      </div>
      <div class="page">
        <t t-slot="{{state.activeTab}}"/>
      </div>
    </div>`;

  static props = { slots: Object };

  setup() {
    this.tabNames = Object.keys(this.props.slots);
    this.state = useState({ activeTab: this.tabNames[0] });
  }
}
```

Usage with **slot props** (`title` here is a slot prop, not a regular prop):

```xml
<Notebook>
  <t t-set-slot="page1" title.translate="Page 1">
    <div>This is in the page 1</div>
  </t>
  <t t-set-slot="page2" title.translate="Page 2" hidden="somevalue">
    <div>This is in the page 2</div>
  </t>
</Notebook>
```

Key facts:

- `props.slots` is how a component reads meta-info about its slots: a dictionary keyed by slot name, with each value containing the slot's params (like `title`, `hidden`).
- Slot params work like normal props — `.translate`, `.bind`, etc. all apply.
- `<t t-slot="{{state.activeTab}}"/>` — the slot name is computed at render time.

## 5. Scoped slot — expose a value from child to slot content

Parent template:

```xml
<MyComponent>
  <t t-set-slot="row" t-slot-scope="scope">
    <span t-esc="scope.item.label"/> — <em t-esc="scope.item.value"/>
  </t>
</MyComponent>
```

Child renders the slot with per-instance values:

```xml
<t t-foreach="items" t-as="item" t-key="item.id">
  <t t-slot="row" item="item"/>
</t>
```

Or with a props object:

```xml
<t t-slot="row" t-props="buildRowScope(item)"/>
```

Shortcut for the default slot:

```xml
<MyComponent t-slot-scope="scope">
  <span t-esc="scope.item.label"/>
</MyComponent>
```

`t-props` on a slot call is equivalent to spreading an object as slot props. `.bind` works on slot props just like on regular ones.

## 6. Passing slots through

A wrapper component can forward received slots into a further-nested child:

```js
class Wrapper extends Component {
  static template = xml`
    <div class="wrapper">
      <Inner slots="props.slots"/>
    </div>`;
  static components = { Inner };
  static props = { slots: { type: Object, optional: true } };
}
```

## 7. Slots + `static props`

If you use slots AND declare props, you must whitelist `slots`:

```js
static props = ["someProp", "slots?"];

// or with schema:
static props = {
  someProp: { type: String, optional: true },
  slots: { type: Object, optional: true },
};
```

Otherwise OWL's dev-mode validation will error on the unexpected `slots` prop.
