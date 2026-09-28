# Components & Lifecycle

Sources: `component.md`, `hooks.md` (lifecycle table), `readme.md`.

## The `Component` class

A component is an ES class that extends `Component` from `@odoo/owl`. It has:

- `static template` — either a template name string (`"addon.ComponentName"`) or an inline template via the `xml` tagged template.
- `static components` (optional) — an object mapping tag names used in the template to sub-component classes.
- `static props` (optional) — the props declaration (array of names or schema object). See `05_props.md`.
- `static defaultProps` (optional) — default values for top-level props. OWL creates a new (altered) props object; the parent's original object is not mutated (`component.md`).
- `setup()` — the single place to call hooks and initialise instance state.

Instance-level API (`component.md`):

- `this.env` — the component environment (shared, propagated from parent).
- `this.props` — the props object, given by the parent. _"Note that `props` are owned by the parent, not by the component. As such, it should not ever be modified by the component (otherwise you risk unintended effects, since the parent may not be aware of the change)!!"_ When the parent updates props, the child goes through `willUpdateProps` → `willPatch` → `patched`.
- `this.render(deep?)` — imperative re-render. Async (lands on the next animation frame). By default the re-render _stops_ at children whose shallow-equal props have not changed. Pass the literal boolean `true` (not a truthy value) to force all sub-components to re-render.

Component identity helper from the top-level export (`readme.md`):

```js
import { status } from "@odoo/owl";

status(component);
// 'new'       — constructed but not mounted yet
// 'mounted'   — currently mounted in the DOM
// 'cancelled' — not mounted yet and will be destroyed soon
// 'destroyed' — destroyed
```

## Lifecycle — table (verbatim from `hooks.md`)

| Method (legacy) | Hook              | Description                                            |
|-----------------|-------------------|--------------------------------------------------------|
| `setup`         | —                 | constructor-time setup (for hooks and instance state)  |
| `willStart`     | `onWillStart`     | async, before the first rendering                      |
| `willRender`    | `onWillRender`    | just before component is rendered                      |
| `rendered`      | `onRendered`      | just after component is rendered                       |
| `mounted`       | `onMounted`       | just after the component is rendered and in the DOM    |
| `willUpdateProps` | `onWillUpdateProps` | async, before new props are applied                |
| `willPatch`     | `onWillPatch`     | just before the DOM is patched                         |
| `patched`       | `onPatched`       | just after the DOM is patched                          |
| `willUnmount`   | `onWillUnmount`   | just before the component is removed from the DOM      |
| `willDestroy`   | `onWillDestroy`   | just before the component is destroyed                 |
| `error`         | `onError`         | catch and handle errors propagating from children      |

In OWL 2 you register lifecycle callbacks using the `on*` hooks inside `setup()`; the "method" column exists because OWL components are classes and methods of the same name are honoured too, but the hook form is the recommended style.

### Ordering (from `component.md`)

This is the piece most OWL bugs are about. Know it cold.

- `willStart`: parents first, then children. Awaited.
- `willRender`: parent → children.
- `rendered`: parent → children. The DOM may not exist yet (first render) or may not be up to date.
- `mounted`: **children first, then parents**.
- `willUpdateProps`: parents first, then children.
- `willPatch`: parent → children. **Mutating state is not allowed here.** Not called on the initial render. Not called if the component is not in the DOM.
- `patched`: **children first, then parent.** Not called on the initial render. State mutation is allowed but can create endless cycles; be careful.
- `willUnmount`: parents first, then children. May be skipped if a component is destroyed before being mounted.
- `willDestroy`: **children first, then parents.** _Always_ called.

Concrete verbatim example of an update lifecycle from `concurrency_model.md` (C re-renders, adds F, removes E):

1. `render` is called on C.
2. Template C is rendered again in memory.
   - D is updated: `willUpdateProps` on D, then template D rerendered.
   - F is created: `willStart` on F (async), then template F rendered.
3. `willPatch` on C, then D (not F — it is not mounted yet).
4. F and D are patched in that order.
5. C is patched, which recursively: `willUnmount` on E, then destruction of E.
6. `mounted` on F; `patched` on D and C.

### Per-hook notes

- **`setup`** — called just after the class constructor. Receives no arguments. _"It is the proper place to call hook functions. Note that one of the main reason to have the `setup` hook in the component lifecycle is to make it possible to monkey patch it. It is a common need in the Odoo ecosystem."_
- **`onWillStart`** — async; awaited before the first render. Multiple `onWillStart` callbacks registered in `setup` **run in parallel**, not sequentially. In dev mode, OWL warns if a callback takes over 3 seconds (`app.md`). Use for initial data loading and lazy library loading (per the concurrency model's advice).
- **`onWillRender` / `onRendered`** — uncommon. Fired around the compiled template function's execution. Order: parent → children.
- **`onMounted`** — children first, then parent. _"It is allowed (but not encouraged) to modify the state in the `mounted` hook. Doing so will cause a rerender, which will not be perceptible by the user, but will slightly slow down the component."_
- **`onWillUpdateProps(nextProps)`** — async; receives the incoming props. Not called on first render. Parent → children.
- **`onWillPatch`** — called just before the DOM patch. Modifying state here is forbidden. Typical use: read and capture DOM state (scroll position, selection) that you want to restore in `onPatched`.
- **`onPatched`** — children first, then parent. State mutation is possible but can loop if `onPatched` triggers another render that again triggers `onPatched`. Use with discipline.
- **`onWillUnmount`** — symmetric to `onMounted`; parent first, then children. If a component is destroyed before being mounted, `willUnmount` may not be called — use `onWillDestroy` for hard-guaranteed cleanup.
- **`onWillDestroy`** — always runs. Children first, then parents. The safe place to release whatever was acquired in `setup` regardless of mount state.
- **`onError`** — see `10_errors_testing.md`.

### Canonical cleanup pattern (`hooks.md`)

```js
setup() {
  onMounted(() => {
    // add some listener
  });
  onWillUnmount(() => {
    // remove listener
  });
}
```

Or, if the listener should also be cleaned up when the component never mounts, use `onWillDestroy`.

## Sub-components

Registered statically and referenced with a capitalised tag:

```js
import { Component, xml } from "@odoo/owl";

class Child extends Component {
  static template = xml`<div>child: <t t-esc="props.value"/></div>`;
}

class Parent extends Component {
  static template = xml`
    <div>
      <Child value="1"/>
      <Child value="2"/>
    </div>`;
  static components = { Child };
}
```

Sub-component props are the template attributes that do **not** start with `t-` (`props.md`). Attributes starting with `t-` are QWeb directives, not props.

## Dynamic sub-components — `t-component`

When the component class should be chosen at render time:

```js
class A extends Component { static template = xml`<div>a</div>`; }
class B extends Component { static template = xml`<span>b</span>`; }

class Parent extends Component {
  static template = xml`<t t-component="myComponent"/>`;

  state = useState({ child: "a" });

  get myComponent() {
    return this.state.child === "a" ? A : B;
  }
}
```

The value passed to `t-component` is an expression that evaluates to a component class (`component.md`). OWL 2 no longer accepts a string (CHANGELOG: _"`t-component` no longer accepts strings"_). Pair with `t-props="someObject"` if you need to forward arbitrary props.

## Constructor — why you must not override it

From the Odoo 19 reference (`owl_components.html`):

> _First of all, components are classes, so they have a constructor. But constructors are special methods in javascript that are not overridable in any way. Since this is an occasionally useful pattern in Odoo, we need to make sure that no component in Odoo directly uses the constructor method. Instead, components should use the `setup` method._

Concrete anti-example (cited verbatim):

```js
// incorrect. Do not do that!
class IncorrectComponent extends Component {
  constructor(parent, props) {
    // initialize component here
  }
}
```

Always use `setup()`. That is also the only place hooks can be called (see `04_hooks.md`).

## Static class fields in browsers

The Odoo docs note: _"We defined here the template as a static property, but without using the `static` keyword, which is not available in some browsers (Odoo javascript code should be Ecmascript 2019 compliant)."_ The tutorial also remarks that the `static` class-field syntax may need transpilation for wide browser support. OWL itself does not constrain this — the caveat is about the build pipeline the host app uses.

## Fragments

OWL 2 components can have multiple root elements or none at all (just a text node) — `templates.md` says: _"Owl 2 supports templates with an arbitrary number of root elements, or even just a text node."_ Consequence: `component.el` no longer exists (see CHANGELOG). Use `useRef` on a specific element instead.

## Minimal reference example (verbatim from the TodoApp tutorial, `learning/tutorial_todoapp.md`)

```js
const { Component, mount, xml } = owl;

class Root extends Component {
  static template = xml`<div>todo app</div>`;
}

mount(Root, document.body);
```

For a richer example with state and sub-components, see `examples/counter.md`.
