# Rendering pipeline, Fiber, and async rendering

Sources: `concurrency_model.md`, `architecture.md`, `compiled_template.md`, `component.md` (for `render(deep)`).

OWL calls its rendering model the "concurrent mode". This file explains what that actually means, in enough detail that you can reason about re-renders.

## The three moving parts (`architecture.md`)

> _"There are several classes involved in a rendering: components, a scheduler, fibers: small objects containing some metadata, associated with a rendering of a specific component."_

- **Components** — the user-visible tree.
- **Fibers** — one per in-flight render of a specific component; hold render metadata (incoming props, callbacks, cancellation state).
- **Scheduler** — a polling loop that runs every animation frame. It checks whether the fibers it is tracking are done, and calls their task callback (which performs the patch).

When a render is initiated at a node `C`:

1. A fiber is created on `C` with the rendering props.
2. The virtual-rendering phase starts on `C`; it recursively renders descendants.
3. The fiber is added to the scheduler.
4. On each animation frame, the scheduler polls "are we done?" — once yes, it calls the task callback, which applies the patch.
5. If the render is cancelled in the meantime, the task callback is not called.

## Two phases of any render (`concurrency_model.md`)

> _"When a component is mounted or updated, a new rendering is started. It has two phases: virtual rendering and patching."_

### Phase 1 — virtual rendering (async, recursive)

> _"This phase represent the process of rendering a template, in memory, which creates a virtual representation of the desired component html. The output of this phase is a virtual DOM. It is asynchronous: each subcomponents needs to either be created (so, `willStart` will need to be called), or updated (which is done with the `willUpdateProps` method). This is completely a recursive process: a component is the root of a component tree, and each sub component needs to be (virtually) rendered."_

Every `willStart` and `onWillUpdateProps` in the subtree is awaited. Until they all resolve, the phase doesn't finish.

### Phase 2 — patching (synchronous, frame-aligned)

> _"Once a rendering is complete, it will be applied on the next animation frame. This is done synchronously: the whole component tree is patched to the real DOM."_

This is where `willPatch` and `patched` fire, and where the DOM actually changes. It runs on the animation frame — not immediately after the promise resolves.

### What "batched once per animation frame" means

> _"Owl uses it to only apply the result of many different renderings only once in an animation frame."_

If 50 reactive writes fire synchronously, the scheduler collapses them into a single patch on the next animation frame. You don't need to batch by hand — OWL does.

> _"Owl can cancel a rendering that is no longer relevant, restart it, reuse it in some cases."_

This is why `render()` doesn't return a promise in OWL 2 (CHANGELOG): a render can be cancelled or superseded, so a promise that represents "this render" has no clean semantics.

## Scenario 1 — initial rendering (verbatim from `concurrency_model.md`)

Tree:

```
    A
   / \
  B   C
     / \
    D   E
```

1. `willStart` is called on A.
2. When it resolves, template A is rendered.
   - Component B is created: `willStart` on B, then template B rendered.
   - Component C is created: `willStart` on C, then template C rendered.
     - Component D is created: `willStart` on D, then template D rendered.
     - Component E is created: `willStart` on E, then template E rendered.
3. Each component is patched into a detached DOM element, in the order `E, D, C, B, A` (so the full DOM tree is built in one pass).
4. The component A root element is appended to `document.body`.
5. `mounted` is called recursively in the order `E, D, C, B, A` (children first, then parents).

## Scenario 2 — update at a specific node C (verbatim, slightly reformatted)

C triggers a render: updating D, removing E, adding F.

1. `render` is called on C (because of a state change).
2. Template C is rendered again.
   - D is updated: `willUpdateProps` (async), then template D rendered.
   - F is created: `willStart` (async), then template F rendered.
3. `willPatch` is called recursively on C, D (not F — it is not mounted yet).
4. F and D are patched in that order.
5. C is patched, which causes: `willUnmount` on E, then destruction of E.
6. `mounted` is called on F; `patched` is called on D and C.

Internalise this ordering — it is the single source of truth for when to put side effects in which hook.

## `render(deep?)` — manual imperative re-render

Component method (`component.md`):

> _"Note that with the reactivity system, this should be rare to have to do it manually. Also, the rendering operation is asynchronous, so the DOM will only be updated slightly later (at the next animation frame, if no component delays the rendering)."_

> _"By default, the render initiated by this method will stop at each child component if their props are (shallow) equal. To force a render to update all child components, one can use the optional `deep` argument. Note that the value of the `deep` argument needs to be a boolean, not a truthy value."_

```js
this.render();            // shallow — children whose props didn't change won't re-render
this.render(true);        // deep — re-render all descendants
```

Practical cases where `render(true)` is useful: you keep data outside of OWL's reactive system (e.g. behind `markRaw`, or in a non-reactive cache) and need to manually tell OWL to re-evaluate.

## Async rendering — rules and pitfalls

Explicit guidance from `concurrency_model.md`:

> _"any component can delay the rendering (initial and subsequent) of the whole application."_
> _"for a given component, there are two independant situations that will trigger an asynchronous rerendering: a change in the state, or a change in the props. These changes may be done at different times, and Owl has no way of knowing how to reconcile the resulting renderings."_

Tips (verbatim):

> _"1. Minimize the use of asynchronous components!
> 2. Lazy loading external libraries is a good use case for async rendering. This is mostly fine, because we can assume that it will only takes a fraction of a second, and only once."_

Concrete consequences:

- A slow `willStart` anywhere in the tree blocks the initial paint of the whole app. Keep data loading parallel (multiple `onWillStart` callbacks run in parallel per component) and fast.
- Avoid loading truly optional dependencies in `willStart`; lazy-load them inside a `mounted` handler or via a service.
- If an async `willUpdateProps` is in flight when the parent triggers another props change, OWL handles the reconciliation for you — no manual bookkeeping.

## Dev-mode amenities related to rendering

From `app.md`:

> _"Dev mode activates some additional checks and developer amenities:
> - Props validation is performed
> - `t-foreach` loops check for key unicity
> - Lifecycle hooks are wrapped to report their errors in a more developer-friendly way
> - `onWillStart` and `onWillUpdateProps` will emit a warning in the console when they take longer than 3 seconds in an effort to ease debugging the presence of deadlocks"_

Enable with `new App(Root, { dev: true })` or `mount(Root, document.body, { dev: true })`. Disable on production builds — the extra checks have a measurable cost.

## How templates are compiled (`compiled_template.md`)

OWL compiles each template into a closure that returns a `render(ctx, node, key)` function. The closure captures **static blocks** (HTML fragments with placeholders); the render only computes the **dynamic values** and describes the block-tree structure.

Example template:

```xml
<div class="some-class">
  <div class="blabla">
    <span><t t-esc="state.value"/></span>
  </div>
  <t t-if="state.info">
    <p class="info" t-att-class="someAttribute">
      <t t-esc="state.info"/>
    </p>
  </t>
  <SomeComponent value="value"/>
</div>
```

has 5 dynamic parts: two text values, a sub-block (`t-if`), a dynamic attribute, and a sub-component. Compiled (pseudocode):

```js
function closure(bdom, helpers) {
  let { createBlock, component } = bdom;

  let block1 = createBlock(
    `<div class="some-class">
       <div class="blabla"><span><block-text-0/></span></div>
       <block-child-0/><block-child-1/>
     </div>`
  );
  let block2 = createBlock(
    `<p class="info" block-attribute-0="class"><block-text-1/></p>`
  );

  return function render(ctx, node, key = "") {
    let b2, b3;
    let txt1 = ctx["state"].value;
    if (ctx["state"].info) {
      let attr1 = ctx["someAttribute"];
      let txt2 = ctx["state"].info;
      b2 = block2([attr1, txt2]);
    }
    b3 = component("SomeComponent", { value: ctx["value"] }, key + "__1", node, ctx);
    return block1([txt1], [b2, b3]);
  };
}
```

Key consequence (`compiled_template.md`):

> _"With this design, the cost of rendering a template is proportional to the number of dynamic values, and not to the size of the template."_

Static markup inside a template is essentially free. If a section never changes, there is no runtime cost to keeping it large. If a section has many interpolations, cost grows with the number of interpolations.

## VDOM — blockdom

`architecture.md` notes that OWL's virtual DOM is in `src/blockdom` and is a fork of [snabbdom](https://github.com/snabbdom/snabbdom). It exports `h` (create a virtual node) and `patch` (diff-and-apply). Most code should never touch these directly — they are low-level primitives used by the compiled render functions.

The blockdom export namespace is available as `owl.blockDom` (see `src/runtime/index.ts`). You should only need it if you are writing a compiler / tool, not for application code.

## Precompiling templates (`precompiling_templates.md`)

By default OWL compiles templates at runtime with `new Function(...)`. Contexts where that's disallowed (browser extensions, strict CSPs) need precompiled templates. Pipeline:

1. Write templates in XML files (each has a `t-name`).
2. Use OWL's template compiler (`npm run compile_templates -- path/to/templates`) to produce a `templates.js`.
3. Use the `owl.iife.runtime.js` build (no compiler) plus `templates.js` instead of the full IIFE.

In an Odoo context, this is handled by the Odoo assets pipeline — most Odoo apps do not need manual precompilation.

## Mental model summary

- A render is asynchronous and batched. Reactive writes accumulate, and the scheduler patches once per animation frame.
- A render has two phases: recursive async virtual rendering, then synchronous DOM patching.
- Parents do not force children to re-render — children decide based on shallow-equal props + their own reactive subscriptions.
- `render(true)` is the escape hatch for forcing a deep re-render.
- Template cost is proportional to dynamic values, not static markup.
- Slow `willStart` hurts; minimise it, and remember multiple `onWillStart` callbacks on the same component run in parallel.
