# Example: Store — shared reactive state

Source: `reactivity.md` (verbatim).

OWL 2 has no dedicated `Store` class (`Store` was removed in the 1.x→2.x migration). A `reactive` object IS your store. Multiple components subscribe by wrapping it with `useState`.

## Minimal store

```js
import { reactive, useState, Component, xml } from "@odoo/owl";

// module-level reactive: lives as long as the module
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

## Consumer

```js
import { useStore } from "./store";

class List extends Component {
  static template = xml`
    <t t-foreach="store.list" t-as="item" t-key="item" t-esc="item"/>`;

  setup() {
    this.store = useStore();
  }
}
```

## Trigger updates from anywhere

```js
import { store } from "./store";

// Will cause every List instance in the app to update
store.add("New list item!");
```

## Class-based equivalent

```js
class Store {
  list = [];
  add(item) {
    this.list.push(item);
  }
}

export const store = reactive(new Store());
```

The two forms are interchangeable. Pick whichever reads better for your team.

## Why this works

- `reactive(store)` creates a Proxy over the store object.
- Each consumer calls `useState(store)`, which does `reactive(store, thisComponentsRenderFn)` under the hood. That establishes a per-component observer on top of the shared store.
- Reading `this.store.list` in the template subscribes this component to `list`. Writing to it fires every subscriber. Unrelated reads in other components are not affected.

## Persisted store (localStorage)

```js
function useStoredState(key, initialState) {
  const state = JSON.parse(localStorage.getItem(key)) || initialState;
  const save = (obj) => localStorage.setItem(key, JSON.stringify(obj));
  const reactiveState = reactive(state, () => save(reactiveState));
  save(reactiveState);   // first call — reads every key so all are subscribed
  return useState(state);
}
```

Why the initial `save(reactiveState)` is needed: the callback is only invoked for _tracked_ keys; we need the first call to read every key through the proxy so all of them are registered. Without that warm-up, nothing is subscribed, and no subsequent write would trigger persistence.

## Module-scoped notification manager (verbatim)

```js
let notificationId = 1;
const notifications = reactive({});

class NotificationContainer extends Component {
  static template = xml`
    <t t-foreach="notifications" t-as="notification"
       t-key="notification_key" t-esc="notification"/>`;

  setup() {
    this.notifications = useState(notifications);
  }
}

export function addNotification(label) {
  const id = notificationId++;
  notifications[id] = label;
  return () => {
    delete notifications[id];
  };
}
```

The imperative API (`addNotification` and its returned remover) can be called from anywhere in the app; every `NotificationContainer` on screen updates automatically.

## When to pass a store by prop vs. via env

- **Prop** — when the store is specific to a sub-tree (e.g. a form's model; a page's view state).
- **Env** — when the store is app-wide and most components need it; use `useSubEnv({ myStore })` at a root and access with `useEnv()` in descendants.

Both approaches play well with fine-grained re-renders (see `references/02_reactivity.md`). Pick the one that keeps the dependency graph most explicit.

## Gotcha: holding refs past component lifetime

`reactivity.md` warns: _"keep in mind that holding a reference to a reactive object prevents the garbage collector from reclaiming it, which may keep a component alive after it has been destroyed."_ Practically: callbacks stored outside the component (global listeners, external event buses) that capture the `useState` proxy will keep the component alive. Clean up in `onWillDestroy`.
