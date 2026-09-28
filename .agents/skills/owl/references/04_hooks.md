# Hooks

Sources: `hooks.md`, `readme.md` (exports), `component.md` (lifecycle timing).

A hook is a function that "hooks into" the internals of the current component. In OWL, every hook is tied to the component it is declared in, and OWL establishes that link by reading the currently-initialising component off a module-internal slot. This is why there is exactly one rule for where hooks may be called.

## The Hook Rule (verbatim from `hooks.md`)

> _"every hook for a component has to be called in the `setup` method, or in class fields."_

```js
// OK
class SomeComponent extends Component {
  state = useState({ value: 0 });
}

// OK
class SomeComponent extends Component {
  setup() {
    this.state = useState({ value: 0 });
  }
}

// NOT OK — this runs after the constructor has finished
class SomeComponent extends Component {
  async willStart() {
    this.state = useState({ value: 0 });
  }
}
```

Consequence: if you need to do something conditionally, you still register the hook unconditionally; you branch inside the hook's callback, not around the hook call.

Convention: custom hooks start with `use`; lifecycle hooks start with `on`.

## Lifecycle hooks (table)

See `01_component_lifecycle.md` for per-hook timing and ordering. The registered names (exported from `@odoo/owl`):

| Hook | Description |
|------|-------------|
| `onWillStart` | async, before the first render |
| `onWillRender` | just before the template function runs |
| `onRendered` | just after the template function runs (DOM may not be updated yet) |
| `onMounted` | after the component has been patched to the DOM |
| `onWillUpdateProps` | async, before new props are applied |
| `onWillPatch` | just before the DOM is patched (state mutation forbidden here) |
| `onPatched` | after the DOM has been patched |
| `onWillUnmount` | before the component is removed from the DOM |
| `onWillDestroy` | before the component is destroyed (always runs) |
| `onError` | handles errors propagating from descendants |

## `useState(obj | array)` → reactive state

See `02_reactivity.md`. The `useState` hook takes an object (or array) and returns a Proxy-wrapped reactive version that re-renders the component when any read key changes.

## `useRef(name)` → DOM reference

Pair with `t-ref="name"` in the template. Returns an object whose `.el` is the bound `HTMLElement` once the component is mounted, `null` otherwise.

```xml
<div>
  <input t-ref="someInput"/>
  <span>hello</span>
</div>
```

```js
import { useRef } from "@odoo/owl";

class Parent extends Component {
  setup() {
    this.inputRef = useRef("someInput");
  }

  focus() {
    // valid only while mounted
    this.inputRef.el?.focus();
  }
}
```

Rules (from `hooks.md` / `refs.md`):

- _"References are only guaranteed to be active while the parent component is mounted. If this is not the case, accessing `el` on it will return `null`."_
- _"The `useRef` hook cannot be used to get a reference to an instance of a sub component."_ In OWL 2, `t-ref` is for DOM nodes only.
- Dynamic names are supported via string interpolation:

  ```xml
  <div t-ref="div_{{someCondition ? '1' : '2'}}"/>
  ```

  ```js
  this.ref1 = useRef("div_1");
  this.ref2 = useRef("div_2");
  ```

Convention: suffix refs with `Ref`.

## `useEnv()` → current env

Returns `this.env`. Typically used inside a custom hook that does not otherwise need the component instance.

```js
function useSomething() {
  const env = useEnv();
  // ...
}
```

## `useComponent()` → current component instance

Returns `this`. Building block for custom hooks that want to operate on the instance.

```js
function useSomething() {
  const component = useComponent();
  // ...
}
```

## `useSubEnv(obj)` / `useChildSubEnv(obj)`

Propagate environment values down the tree. The difference is where the new env applies:

- `useSubEnv(obj)` — adds keys for **the current component and all its descendants**.
- `useChildSubEnv(obj)` — adds keys for **descendants only** (the current component still sees the old env).

Both produce a new, frozen env object. They can be called any number of times (`hooks.md`).

```js
class FormComponent extends Component {
  setup() {
    const model = makeModel();
    useSubEnv({ model });             // model available on this.env + children
    useChildSubEnv({ someKey: "v" });  // someKey available on children only
  }
}
```

## `useEffect(effectFn, depsFn?)`

Runs a callback after mount / after patches, with optional cleanup.

- `effectFn(...deps)` — called with the deps as arguments. May return a cleanup function.
- `depsFn()` — returns the deps array. If `depsFn` is omitted, `effectFn` is cleaned up and rerun on **every patch**.

The deps are produced by a function (unlike React's literal array) so OWL can re-evaluate them at the right time.

### Mount-only effect

```js
import { useEffect } from "@odoo/owl";

useEffect(
  () => {
    window.addEventListener("mousemove", someHandler);
    return () => window.removeEventListener("mousemove", someHandler);
  },
  () => []
);
```

### Effect that runs when a ref becomes available

```js
function useAutofocus(name) {
  let ref = useRef(name);
  useEffect(
    (el) => el && el.focus(),
    () => [ref.el]
  );
}
```

Usage:

```js
class SomeComponent extends Component {
  static template = xml`
    <div>
      <input/>
      <input t-ref="myinput"/>
    </div>`;

  setup() {
    useAutofocus("myinput");
  }
}
```

## `useExternalListener(target, event, callback, options?)`

Install an event listener on an external target (typically `window` or `document`) for the lifetime of the component. Automatically removed on unmount.

```js
import { useExternalListener } from "@odoo/owl";

useExternalListener(window, "click", this.closeMenu, { capture: true });
```

This is the exported name in `src/runtime/index.ts` (OWL 2.x public API) and in `hooks.md`.

## Custom hooks — convention and an example

Any function that calls other hooks and starts with `use` is a valid custom hook. The canonical example (`hooks.md`) is `useMouse`:

```js
import { useState, onWillDestroy, Component, xml } from "@odoo/owl";

function useMouse() {
  const position = useState({ x: 0, y: 0 });

  function update(e) {
    position.x = e.clientX;
    position.y = e.clientY;
  }
  window.addEventListener("mousemove", update);
  onWillDestroy(() => {
    window.removeEventListener("mousemove", update);
  });

  return position;
}

class Root extends Component {
  static template = xml`
    <div>Mouse: <t t-esc="mouse.x"/>, <t t-esc="mouse.y"/></div>`;

  mouse = useMouse();
}
```

Observations:

- The hook owns the state (`useState`) so consumers get reactivity for free.
- It cleans up with `onWillDestroy` rather than `onWillUnmount` so cleanup always runs, even if the component never mounts.
- It reads from `window` directly — in a testable Odoo codebase you might go through the `browser` service (see `12_odoo_appendix.md`).

## Hook cleanup: `onWillUnmount` vs `onWillDestroy`

`component.md` warns: _"if a component is destroyed before being mounted, the `willUnmount` method may not be called."_ `willDestroy` is always called. Use `onWillDestroy` when the work MUST be cleaned up regardless of mount state (removing a global listener, releasing an external resource). Use `onWillUnmount` for DOM-only cleanup that is meaningful only when the component was in the DOM.

## What `useState` does differently from `reactive`

`useState(obj)` is essentially `reactive(obj, renderFn)` where `renderFn` is the current component's render. That binding is only set up correctly when you call it in `setup()` (or class fields); elsewhere the current-component slot is no longer set, and the hook will fail or misbehave. See `02_reactivity.md` for full semantics.
