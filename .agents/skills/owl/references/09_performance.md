# Performance — how OWL re-renders, and how to avoid unnecessary work

Sources: `reactivity.md`, `props.md`, `component.md`, `concurrency_model.md`, `event_handling.md`, `utils.md`, `compiled_template.md`.

This file consolidates every performance-relevant statement from the official docs into one place. All guidance below is directly backed by the cited sources.

## Mental model of re-renders

1. Reactive writes schedule a render on whichever components are subscribed to the changed key.
2. A scheduled render runs **asynchronously** on the next animation frame. Multiple writes within the same tick are batched into a single render (`concurrency_model.md`).
3. When a component renders, each sub-component is checked: if its props are **shallow-equal** to the previous render, it is **skipped**. Otherwise OWL recurses into it (`props.md`).
4. Reactive objects passed as props are **reobserved** by the child — the child only re-renders when one of the keys _it actually reads_ changes (`reactivity.md`).

Every performance optimisation below comes out of these four rules.

## 1. Stop churning props on every render

The shallow-equality check on props is the single most important lever. Any time a parent re-renders, it passes props to its children; if any prop's reference changed, the child re-renders even if its observable state didn't. The usual culprits:

- **Anonymous lambdas passed as handlers** — a new reference every render.
- **Inline objects / arrays literals** — `value="{id: 1}"` is a new object each render.
- **Derived values that aren't memoised.**

Remedies:

- **`.bind` suffix for methods** (`props.md`): `onClick.bind="handleClick"` passes `this.handleClick` bound to the parent; `.bind` implies `.alike`, so the child does not see the prop as changing.
- **`.alike` suffix for stable lambdas** — use only when the lambda's captured state really doesn't change between renders. The doc warns:

  ```xml
  <!-- Probably wrong! todo.isCompleted may change -->
  <Todo todo="todo" toggle.alike="() => toggleTodo(todo.isCompleted)"/>
  ```

  because the captured `todo.isCompleted` can become stale.

- **Lift inline objects to getters or class fields** so the reference is stable across renders when the value is stable.

See also: `05_props.md`.

## 2. Use the reactivity system's granularity

> _"Since version 2.0, Owl renders are no longer 'deep' by default: a component is only rerendered by its parent if its props have changed. … If that prop is reactive, Owl will rerender the child components that need to be updated automatically, and only those components."_ (`reactivity.md`)

The win: pass a reactive store as a prop (or through `env`) and let each leaf component subscribe to only the keys it reads. The intermediate components do not re-render when a leaf's key changes.

Best practice: design state so components read _the smallest set of keys they need_. Avoid `JSON.stringify(state)` — it would read every key and subscribe the component to all of them.

Related: **ephemeral subscriptions**. Writes to keys behind an inactive `t-if` branch do not trigger re-renders (the component isn't subscribed to them during this render). This is correct OWL behaviour, not a bug (`reactivity.md`).

## 3. `render(deep)` defaults to shallow — keep it that way

`this.render()` re-renders the component and cascades only into sub-components whose shallow-equal props changed. Passing `this.render(true)` forces a deep render; use it **only** when you have state that OWL can't observe (e.g. behind `markRaw`) and you need to propagate anyway.

The doc is explicit: _"the value of the `deep` argument needs to be a boolean, not a truthy value."_ (`component.md`) — `this.render(1)` or `this.render("yes")` does not do a deep render.

## 4. `markRaw` — opt out of reactivity for hot data

`markRaw(obj)` marks an object so OWL never creates a Proxy for it. The primary use case from `reactivity.md` is large arrays of immutable items where creating one Proxy per element during a render is visible in the profile:

```js
this.items = useState([
  markRaw({ label: "some text", value: 42 }),
  // ... 1000 objects
]);
```

The official guidance is explicit: _"only use `markRaw` if your application is slowing down noticeably and profiling reveals that a lot of time is spent creating useless reactive objects."_

### Gotcha: you must replace, not mutate

```js
// OK — pushes a new item; the array is still reactive at the top
this.items.push(markRaw({ label: "another", value: 1337 }));

// WRONG — no re-render will fire
this.items[17].value = 3;
```

Once an object is `markRaw`, mutating its fields is invisible to OWL. To update the UI, replace the whole entry with a new `markRaw` object.

## 5. `.synthetic` events — a single listener for huge lists

`event_handling.md`:

> _"In some cases, attaching an event handler for each element of large lists has a non trivial cost. Owl provides a way to efficiently improve the performance: with synthetic event, it actually adds only one handler on the document body, and will properly call the handler, just as expected."_

```xml
<div>
  <t t-foreach="largeList" t-as="elem" t-key="elem.id">
    <button t-on-click.synthetic="doSomething">Click</button>
  </t>
</div>
```

Use when: the list is large (hundreds of items or more), handlers are homogeneous, and you don't need to stop propagation before it reaches `document.body`.

## 6. `batched(fn)` — batch callbacks in a microtick

From `utils.md`:

> _"The `batched` function creates a batched version of a callback so that multiple calls to it within the same microtick will only result in a single invocation of the original callback."_

```js
import { batched } from "@odoo/owl";

function save() { /* persistence */ }

const batchedSave = batched(save);
batchedSave();  // no-op
batchedSave();  // still nothing

await Promise.resolve();
// save() ran once
```

Use for reactive store callbacks that would otherwise fire once per write and you want them to fire once per tick (e.g. persisting to localStorage).

## 7. Keep `willStart` fast; parallelise

`component.md` warns:

> _"slow `willStart` code will slow down the rendering of the user interface. Therefore, some care should be made to make this method as fast as possible."_

And:

> _"if there are more than one `onWillStart` registered callback, then they will all be run in parallel."_

Concrete tactics:

- Register several `onWillStart` callbacks for independent async work instead of one big awaited chain.
- Move truly optional work out of `willStart` into `onMounted` — the paint happens first, and the extra work lands asynchronously without blocking the initial render.
- Use `memoize` or a cache service to skip repeated network calls (Odoo 19 tutorial ch.2 shows this pattern with `memoize` from `@web/core/utils/functions`).

Dev-mode warning: `onWillStart` and `onWillUpdateProps` that take more than 3 seconds log a warning to the console (`app.md`). Treat that as a soft SLO.

## 8. Minimise `mounted` / `patched` state mutations

Both hooks trigger another render cycle when they mutate state.

- `mounted` mutation is allowed but not encouraged (`component.md`): _"Doing so will cause a rerender, which will not be perceptible by the user, but will slightly slow down the component."_
- `patched` mutation is a loop hazard: _"updates here will create an additional rendering, which in turn will cause other calls to the `patched` method. So, we need to be particularly careful at avoiding endless cycles."_

`willPatch` forbids state mutation outright — it is the right place to _read_ DOM state (e.g. scroll position) and capture it so you can restore it in `patched`.

## 9. Use `t-key` intelligently

A correct key makes OWL's VDOM reconciliation move DOM nodes instead of rebuilding them — preserving focus, scroll, selection, and animation state. From `templates.md`:

> _"A key should be a unique number or string (objects will not work)."_

Using the index as a key is fine only for append-only, order-stable lists. Otherwise it causes unnecessary DOM rebuilds when an item is inserted or removed; the nodes stay, but their bound state is attached to the wrong item.

## 10. Templates — static markup is free; dynamic values cost

From `compiled_template.md`:

> _"With this design, the cost of rendering a template is proportional to the number of dynamic values, and not to the size of the template."_

Don't break a large template into many small components just to "make it cheaper to render". The underlying cost doesn't change. Break it up for logical reasons (reuse, testability, reactive boundaries), not for perf.

## 11. Avoid re-reading reactive keys you don't need

Because reading subscribes, pulling an unused key just to peek at it creates an unnecessary subscription that costs a render whenever the key changes. Common pitfalls:

- `Object.keys(state)` reads a lot of keys at once.
- Destructuring `const { ... } = state` when the component only needs one key.
- Logging state for debug (`console.log(state)`) during a render.

The rule: touch reactive proxies only for the data you consume.

## 12. Debugging subscriptions (dev-only)

`reactivity.md`:

> _"Owl provides a way to show which reactive objects and keys a component is subscribed to: you can look at `component.__owl__.subscriptions`."_

Use in a devtools console to audit over-subscription during perf tuning. Do not rely on it in production — the shape is unstable.

## 13. Use the Owl Devtools extension

Odoo 19 tutorial ch.1 tip: _"If you use Chrome as your web browser, you can install the `Owl Devtools` extension."_ (extension link from the README — available for Chrome and Firefox.) The devtools show the component tree, render timings, subscribed keys, and more.

## 14. Precompile templates when you can

Runtime template compilation uses `new Function(...)`. In contexts where that is disallowed (strict CSP, browser extensions) or just to save the upfront cost on a cold start, precompile templates to `templates.js` and ship the `owl.iife.runtime.js` runtime (see `precompiling_templates.md`).

For Odoo apps, template compilation is handled by the assets pipeline and usually does not need manual intervention.

## Quick performance checklist

Before you "optimise" OWL code, run through this list:

- [ ] Every child that receives a lambda uses `.bind` or `.alike` where appropriate.
- [ ] Every `t-foreach` has a stable `t-key` using an intrinsic id.
- [ ] Large homogeneous lists use `t-on-*.synthetic` for row-level handlers.
- [ ] Very large immutable item arrays use `markRaw` on the items.
- [ ] Callbacks that fan out into many writes are wrapped in `batched`.
- [ ] `willStart` is as small and parallelised as possible; purely optional work is in `mounted` instead.
- [ ] Components do not mutate state in `willPatch`; do so in `patched` only when strictly necessary.
- [ ] Components read only the reactive keys they consume (no wholesale `Object.keys`, no defensive destructuring).
- [ ] Dev mode (`dev: true`) is enabled in development but disabled in production.
- [ ] Props declarations (`static props`) exist on components — enabled validation catches shape-drift early.

If you're still slow after the checklist, measure with the Devtools extension and the browser's performance panel. Don't guess.
