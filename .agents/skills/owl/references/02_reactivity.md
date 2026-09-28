# Reactivity

Sources: `reactivity.md`, `hooks.md` (`useState` section), `component.md` (render-triggering).

OWL's reactivity is a single primitive, `reactive`, with `useState` as the component-bound wrapper. Both are exported from `@odoo/owl`.

## The model in one paragraph (from `reactivity.md`)

> _"Owl provides a proxy-based reactivity system, based on the `reactive` primitive. The `reactive` function takes an object as a first argument, and an optional callback as its second argument, it returns a proxy of the object. This proxy tracks what properties are read through the proxy, and calls the provided callback whenever one of these properties is changed through any reactive version of the same object. It does so in depth, by returning reactive versions of the subobjects when they are read."_

So reading a property _subscribes_ the current observer to that property. Writing it _notifies_ observers.

## `useState(obj | array)`

`useState` is behaviourally `reactive(obj, componentRenderFn)`. Calling it in `setup()` binds the observer to the current component's render function.

```js
import { Component, useState, xml } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
    <button t-on-click="increment">
      Click [<t t-esc="state.value"/>]
    </button>`;

  setup() {
    this.state = useState({ value: 0 });
  }

  increment() {
    this.state.value++;
  }
}
```

Hard rules:

- **Argument must be an object or an array**, not a primitive. _"It is important to remember that `useState` only works with objects or arrays. It is necessary, since Owl needs to react to a change in state."_ (`hooks.md`). A primitive passed in will not be reactive.
- **Must be called in `setup()` or as a class-field initialiser** — see `04_hooks.md`.
- A component can call `useState` multiple times with unrelated objects; there is no limit and no rule that forces a single `state` name.

## `reactive(obj, cb?)`

The standalone primitive (not tied to a component). Use it for module-level state, stores, or any reactive object whose lifetime is not a component's.

```js
import { reactive } from "@odoo/owl";

const obj = reactive({ a: 1 }, () => console.log("changed"));

obj.a = 2;            // does not log: 'a' has not been read yet
console.log(obj.a);   // logs 2 and reads 'a' → now tracked
obj.a = 3;            // logs 'changed'
```

### Reobservability

A reactive can be passed back through `reactive` to create an independent proxy observed by a different callback. This is how `useState(someReactive)` works — it layers a per-component subscription on top of the external store.

```js
const obj1 = reactive({ a: 1, b: 2 }, () => console.log("observer 1"));
const obj2 = reactive(obj1, () => console.log("observer 2"));

console.log(obj1.a);           // tracked by observer 1
console.log(obj2.b);           // tracked by observer 2
obj2.a = 3;                    // logs 'observer 1' only
obj2.b = 3;                    // logs 'observer 2' only
console.log(obj2.a, obj1.b);   // 3, 3 — same underlying object
```

Cross-usage (`useState` on a `reactive`, or `reactive` on a `useState` result) is allowed; the doc warns about **component lifetime**: holding a reference to a component's `useState` proxy from outside can prevent the component from being garbage collected after OWL destroys it.

## Subscriptions are ephemeral (the single biggest gotcha)

> _"Subscription to state changes are ephemereal, whenever an observer is notified that a state object has changed, all of its subscriptions are cleared, meaning that if it still cares about it, it should read the properties it cares about again."_ (`reactivity.md`)

```js
const obj = reactive({ a: 1 }, () => console.log("observer called"));

console.log(obj.a); // logs 1; 'a' now tracked
obj.a = 3;          // logs 'observer called'; subscriptions cleared
obj.a = 4;          // logs NOTHING — 'a' is no longer tracked
```

This fits a render perfectly: every render re-reads the keys that matter, so the next render only depends on whatever was read last time. Two concrete consequences:

1. **Keys read only inside an inactive `t-if` branch are not subscribed.** Writing to them will not trigger a re-render. When the branch becomes active, the key is read again and then future writes trigger re-renders.
2. **A component only rerenders when there are changes to pieces of state that have been read during or after the previous render.** Keys never read produce no re-render work.

## Reactive props and fine-grained updates (the other big OWL 2 rule)

> _"Since version 2.0, Owl renders are no longer 'deep' by default: a component is only rerendered by its parent if its props have changed (using a simple equality test). What if the contents of a props have changed in a deeper property? If that prop is reactive, owl will rerender the child components that need to be updated automatically, and only those components, it does so by reobserving reactive objects passed as props to components."_ (`reactivity.md`)

Example from the doc (verbatim):

```js
class Counter extends Component {
  static template = xml`
    <div t-on-click="() => props.state.value++">
      <t t-esc="props.state.value"/>
    </div>`;
}

class Parent extends Component {
  static template = xml`
    <Counter state="this.state"/>
    <button t-on-click="() => this.state.value = 0">Reset counter</button>
    <button t-on-click="() => this.state.test++" t-esc="this.state.test"/>`;

  setup() {
    this.state = useState({ value: 0, test: 1 });
  }
}
```

Behaviour:

- Clicking the counter mutates `state.value` → only `Counter` re-renders. `Parent` never read `value`, so it is not subscribed.
- Clicking "Reset counter" → again only `Counter` re-renders. Parent did not read `value`.
- Clicking the `test++` button → `Parent` re-renders because it reads `state.test`. `Counter` does NOT re-render: its props are the same reference, and `test` is not a key it reads through its reactive view.

The takeaway that drives performant OWL code: _"What matters is not where the state is updated, but which parts of the state are updated, and which components depend on them."_

## `Map` and `Set` are fully reactive (OWL 2 specific)

> _"The reactivity system has special support built-in for the standard container types `Map` and `Set`. They behave like one would expect: reading a key subscribes the observer to that key, adding or removing an item to them notifies observers that have used any of the iterators on that reactive object, such as `.entries()` or `.keys()`, likewise with clearing them."_ (`reactivity.md`)

Note: `t-foreach` does **not** accept a `Set` (`templates.md`). Spread it to an array at the call-site:

```xml
<t t-foreach="[...mySet]" t-as="item" t-key="item.id">...</t>
```

## `markRaw(obj)` — opt out of reactivity (performance escape hatch)

> _"Creating proxies when interacting with reactive objects is expensive, and while on the whole, the performance benefit that we get by rerendering only the parts of the interface that need it outweighs that cost, in some cases, we want to be able to opt out of creating them in the first place. This is the purpose of `markRaw`."_ (`reactivity.md`)

```js
import { markRaw, useState } from "@odoo/owl";

const someObject = markRaw({ b: 1 });
const state = useState({ a: 1, obj: someObject });
console.log(state.obj.b);   // attempt to subscribe — ignored
state.obj.b = 2;            // NO rerender
console.log(someObject === state.obj); // true
```

### Large immutable lists — the canonical use case

```js
this.items = useState([
  { label: "some text", value: 42 },
  // ... 1000 total objects
]);
```

```xml
<t t-foreach="items" t-as="item" t-key="item.label"
   t-esc="item.label + item.value"/>
```

> _"Here, on every render, we go and read one thousand keys from a reactive object, which causes one thousand reactive objects to be created. If we know that the content of these objects cannot change, this is wasted work."_

Fix:

```js
this.items = useState([
  markRaw({ label: "some text", value: 42 }),
  // ... 1000 total objects
]);
```

### `markRaw` — the trap

```js
// This will cause a rerender (the array is still reactive at the top level)
this.items.push(markRaw({ label: "another label", value: 1337 }));

// THIS WILL NOT CAUSE A RERENDER!
this.items[17].value = 3;
// The UI is now desynced from the state until the next unrelated rerender.
```

The official doc's guidance: _"only use `markRaw` if your application is slowing down noticeably and profiling reveals that a lot of time is spent creating useless reactive objects."_ (`reactivity.md`)

## `toRaw(proxy)` — get the underlying object

Use when you need identity comparison with the non-proxy version (debugging, serialisation).

```js
import { reactive, toRaw } from "@odoo/owl";

const obj = {};
const reactiveObj = reactive(obj);
obj === reactiveObj;          // false
obj === toRaw(reactiveObj);   // true
```

## Store patterns (replaces the removed `Store` from OWL 1.x)

OWL 2 has no dedicated `Store` class; a `reactive` object IS your store. Official examples (`reactivity.md`):

```js
export const store = reactive({
  list: [],
  add(item) {
    this.list.push(item);
  },
});

export function useStore() {
  return useState(store);
}
```

Equivalent class-based form:

```js
class Store {
  list = [];
  add(item) {
    this.list.push(item);
  }
}
export const store = reactive(new Store());
```

Every component calls `useState(store)` in its `setup` to get a component-bound observer. Writes from anywhere then fan out to the right components.

## Persisting a reactive to localStorage (official example)

```js
function useStoredState(key, initialState) {
  const state = JSON.parse(localStorage.getItem(key)) || initialState;
  const store = (obj) => localStorage.setItem(key, JSON.stringify(obj));
  const reactiveState = reactive(state, () => store(reactiveState));
  store(reactiveState);        // first call to read all keys, else nothing is subscribed
  return useState(state);
}
```

Why the first `store(reactiveState)` call matters: _"we call it with `reactiveState`, not `state`: we need `store` to read the keys through a reactive object for it to correctly subscribe to state changes. Notice also that we call `store` the first time by hand, as otherwise it will not be subscribed to anything, and no amount of change in the object will cause the reactive callback to be invoked."_ (`reactivity.md`)

## Debugging subscriptions (dev-only)

> _"Owl provides a way to show which reactive objects and keys a component is subscribed to: you can look at `component.__owl__.subscriptions`."_ (`reactivity.md`)

**Do not use this in production code**: _"this is on the internal `__owl__` field, and should not be used in any type of production code as the name of this property or any of its properties or methods are subject to change at any point, even in stable versions of Owl."_

## Summary of reactivity rules

- `useState` takes objects/arrays only; call it in `setup` or as a class field.
- Reading subscribes; writing notifies; subscriptions are cleared on every notify and re-established by the next render.
- Since OWL 2, parent re-renders do NOT cascade — children only re-render when either their props fail shallow equality OR when their reactive props' currently-read keys change.
- `Map` and `Set` are reactive; `t-foreach` accepts arrays/objects/maps but not sets.
- `markRaw` opts an object out of reactivity for perf (only after profiling).
- `toRaw` unwraps a proxy back to the underlying object.
- `component.__owl__.subscriptions` is debug-only and unstable.
