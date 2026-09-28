# Example: Custom hooks

Sources: `hooks.md` (verbatim `useMouse`), `hooks.md` (`useAutofocus`).

Custom hooks encapsulate reusable reactive + lifecycle behaviour. Convention: name starts with `use`, defined as a plain function, and can call other hooks (`useState`, `useRef`, `onWillDestroy`, etc.). They **must still follow the hook rule**: the custom hook has to be called in `setup()` or in a class-field initialiser of the consumer.

## `useMouse` — track cursor position

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

What's going on:

- The hook owns the `useState` object, so callers get reactivity for free.
- It uses `onWillDestroy` rather than `onWillUnmount` — cleanup always runs, even if the component is destroyed before being mounted.
- It is called as a class-field initialiser (`mouse = useMouse()`), which is legal per the hook rule.

## `useAutofocus` — focus an input once its ref resolves

```js
import { useRef, useEffect } from "@odoo/owl";

function useAutofocus(name) {
  const ref = useRef(name);
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

Details:

- `useRef(name)` — only meaningful when the component is mounted; `.el` is `null` otherwise.
- `useEffect(effectFn, depsFn)` — runs after mount and after patches, with cleanup before the next run. The deps are a function because the actual values (like `ref.el`) don't exist at `setup` time.
- `() => [ref.el]` — re-runs the effect when the ref target element changes. Pass `() => []` for a mount-only effect.

## `useCurrentTime` — self-updating reactive clock (from Odoo's `framework_overview.html`)

```js
import { useState, onWillStart, onWillUnmount } from "@odoo/owl";

function useCurrentTime() {
  const state = useState({ now: new Date() });
  const update = () => (state.now = new Date());
  let timer;
  onWillStart(() => (timer = setInterval(update, 1000)));
  onWillUnmount(() => clearInterval(timer));
  return state;
}
```

Note: if you want the timer to be cleared even when the component is destroyed before being mounted, use `onWillDestroy` for the cleanup instead.

## `useStoredState` — persisted reactive state

See `examples/store.md`. Reproduced here for convenience:

```js
import { reactive, useState } from "@odoo/owl";

function useStoredState(key, initialState) {
  const state = JSON.parse(localStorage.getItem(key)) || initialState;
  const save = (obj) => localStorage.setItem(key, JSON.stringify(obj));
  const reactiveState = reactive(state, () => save(reactiveState));
  save(reactiveState);   // first call reads every key
  return useState(state);
}
```

## Custom hook cheat-sheet

- Start the name with `use`.
- Call inside `setup()` (or class fields).
- Can call other hooks (`useState`, `useRef`, `useEffect`, lifecycle hooks, etc.).
- Cannot be called conditionally around `setup` time — always call; branch inside the hook's callback if needed.
- Prefer `onWillDestroy` for cleanup that must run regardless of mount state.
- Own your state (`useState`) and return it — that keeps the consumer from having to re-establish reactivity.
