# Example: Counter

Source: `component.md` (verbatim), `reactivity.md` (verbatim).

The canonical "Hello OWL" component. Shows the minimum you need: a class, a template, state, and an event handler.

## Inline-template version

```js
import { Component, useState, xml } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  setup() {
    this.state = useState({ value: 0 });
  }

  increment() {
    this.state.value++;
  }
}
```

- `useState` returns a Proxy over the initial object. Each read during a render subscribes the component. Writing `this.state.value++` triggers a re-render.
- The template is compiled to a render function that builds a virtual-DOM block tree with one text interpolation.
- The button stays the same DOM node across renders; only the text value is patched.

## External-template version (recommended for Odoo modules)

`counter.js`:

```js
import { Component, useState } from "@odoo/owl";

export class Counter extends Component {
  static template = "my_module.Counter";

  setup() {
    this.state = useState({ value: 0 });
  }

  increment() {
    this.state.value++;
  }
}
```

`counter.xml`:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<templates xml:space="preserve">
  <t t-name="my_module.Counter">
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>
  </t>
</templates>
```

## Root that mounts the Counter

```js
import { Component, mount, xml } from "@odoo/owl";
import { Counter } from "./counter";

class Root extends Component {
  static template = xml`
    <div>
      <span>Hello Owl</span>
      <Counter/>
    </div>`;
  static components = { Counter };
}

mount(Root, document.body);
```

## Passing props and defaults

```js
class Counter extends Component {
  static template = xml`
    <button t-on-click="() => state.value = state.value + props.increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  static defaultProps = { increment: 1 };
  static props = {
    increment: { type: Number, optional: true },
  };

  setup() {
    this.state = useState({ value: 0 });
  }
}
```

Parent:

```xml
<Counter increment="2"/>
<Counter/>   <!-- uses defaultProps -->
```

## Key takeaways

- `setup()` is where you initialise state and hooks — never override `constructor`.
- Without `useState`, `state` would be a plain object and mutations would **not** trigger re-renders. The tutorial even invites you to remove `useState` and observe the broken behaviour.
- `t-esc` is slightly faster than `t-out`; use `t-out` only when you need `markup` injection.
- For inline handlers: `() => this.increment()` works because `this` inside the arrow refers to the component. A bare `increment` (without `this.`) might not, depending on scope.
