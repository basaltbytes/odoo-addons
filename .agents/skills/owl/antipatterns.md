# OWL Anti-patterns — consolidated

Every item here is an explicit warning in the official docs (cited per entry). Read this file as a final review pass after completing any non-trivial OWL work.

## 1. Overriding `constructor`

**Source:** `owl_components.html` (Odoo 19 reference).

```js
// WRONG — do not do this.
class BadComponent extends Component {
  constructor(parent, props) {
    super(parent, props);
    // any setup here is fragile and cannot be monkey-patched by addons
  }
}
```

**Fix:** do all setup in `setup()`. _"Components should use the `setup` method."_

## 2. Calling hooks outside `setup()` or class fields

**Source:** `hooks.md`.

```js
// WRONG
class C extends Component {
  async willStart() {
    this.state = useState({ v: 0 });  // too late, constructor already ran
  }
}
```

**Fix:** every hook in `setup()` (or as a class-field initialiser). Branch inside the hook's callback if needed; don't branch around the hook call itself.

## 3. Mutating `props` from the child

**Source:** `props.md`.

```js
// WRONG
class C extends Component {
  someMethod() {
    this.props.items.push({});  // parent is unaware
  }
}
```

**Fix:** _"Props should be considered readonly, from the perspective of the child component."_ If the child needs to modify parent state, the parent passes a callback (use `.bind`).

## 4. Forgetting `t-key` on `t-foreach`

**Source:** `templates.md`, Odoo 19 tutorial ch.1.

```xml
<!-- WRONG — falls back to index as key -->
<t t-foreach="items" t-as="item">
  <li t-esc="item.name"/>
</t>
```

**Fix:** _"Owl requires the presence of a `t-key` directive, to be able to properly reconcile renderings."_ Always:

```xml
<t t-foreach="items" t-as="item" t-key="item.id">
  <li t-esc="item.name"/>
</t>
```

Index is acceptable only for append-only, order-stable lists.

## 5. Using an object as a `t-key`

**Source:** `templates.md`.

```xml
<!-- WRONG — all keys collapse to "[object Object]" -->
<t t-foreach="items" t-as="item" t-key="item"/>
```

**Fix:** use a unique number or string (an intrinsic id).

## 6. Passing a fresh lambda as a prop each render

**Source:** `props.md`.

```xml
<!-- WRONG — new function identity every render, forces Child to re-render -->
<Child onClick="() => doSomething()"/>
```

**Fix:** `.bind` for methods; `.alike` for safe lambdas:

```xml
<Child onClick.bind="doSomething"/>
<Child onClick.alike="() => doSomething(item.id)"/>
```

## 7. `.alike` with captured mutable state

**Source:** `props.md` (verbatim anti-example).

```xml
<!-- WRONG — todo.isCompleted may change, but .alike hides it -->
<Todo todo="todo" toggle.alike="() => toggleTodo(todo.isCompleted)"/>
```

**Fix:** either drop `.alike` (so the child sees the updated lambda), or redesign so the changing value comes from state the child subscribes to directly.

## 8. Defaults on mandatory props

**Source:** `props.md`.

```js
// WRONG — validation error
static props = { count: Number };
static defaultProps = { count: 0 };
```

**Fix:** _"default values cannot be defined for a mandatory props."_ Either make the prop optional:

```js
static props = { count: { type: Number, optional: true } };
static defaultProps = { count: 0 };
```

…or don't declare a default at all.

## 9. Using `useState` on a primitive

**Source:** `reactivity.md`.

```js
// WRONG — returns a Proxy of a Boolean object, not useful
this.flag = useState(false);
```

**Fix:** wrap in an object:

```js
this.state = useState({ flag: false });
```

## 10. Holding references to reactive objects across lifetimes

**Source:** `reactivity.md`.

```js
// WRONG — keeps component alive after destruction
window.globalRef = this.state;
```

**Fix:** clean up external references in `onWillDestroy`. Prefer module-level `reactive` stores for data that genuinely outlives a component.

## 11. Mutating `markRaw` objects in place

**Source:** `reactivity.md` (verbatim).

```js
// WRONG — no re-render
this.items[17].value = 3;
```

**Fix:** replace the whole entry with a new `markRaw` wrapper:

```js
this.items.splice(17, 1, markRaw({ ...this.items[17], value: 3 }));
```

## 12. `markRaw` as a blanket optimisation

**Source:** `reactivity.md`.

Do not `markRaw` everything "for performance". _"Only use `markRaw` if your application is slowing down noticeably and profiling reveals that a lot of time is spent creating useless reactive objects."_

## 13. Mutating state in `willPatch`

**Source:** `component.md`.

```js
// WRONG
onWillPatch(() => {
  this.state.count++;  // doc: "modifying the state is not allowed here"
});
```

**Fix:** `willPatch` is for reading DOM state (scroll, selection); save it to a non-reactive field and restore it in `onPatched`.

## 14. Unbounded updates in `mounted` / `patched`

**Source:** `component.md`.

Mutating state in `mounted` causes an immediate extra render. Mutating in `patched` can loop (`patched` re-fires after the next patch). Either avoid or add a guard.

## 15. Using the index as a key on a mutable list

**Source:** `templates.md` (implicit from the reconciliation description).

Inserting or reordering a list keyed by index keeps DOM nodes attached to the wrong items — focus, selection, animation state all go to the wrong row.

## 16. Using `t-ref` on a component

**Source:** CHANGELOG / `hooks.md`.

```xml
<!-- WRONG -->
<Child t-ref="myChild"/>
```

**Fix:** `t-ref` is for DOM nodes only. For parent↔child interactions, pass callbacks with `.bind`, use scoped slots, or lift state up.

## 17. Passing an expression (not a function) to `t-on-*`

**Source:** OWL 2 CHANGELOG.

```xml
<!-- WRONG — throws -->
<button t-on-click="state.count + 1"/>
```

**Fix:** pass a function:

```xml
<button t-on-click="() => state.count++"/>
<button t-on-click="increment"/>
```

## 18. Reading the whole state during a render

Not an explicit doc warning, but a direct consequence of `reactivity.md` ephemeral subscriptions.

```xml
<!-- This subscribes the component to every key -->
<pre t-esc="JSON.stringify(state)"/>
```

**Fix:** touch only the reactive keys you actually display.

## 19. Falsy values in `t-att-*` interpreted as strings

**Source:** `templates.md`.

Developers often expect `t-att-foo="false"` to produce `foo="false"`. It does not — the attribute is **omitted**. To emit the string `"false"`, use `t-att-foo="'false'"` (a quoted literal) or `t-attf-foo="false"`.

## 20. `t-foreach` over a `Set`

**Source:** `templates.md`.

```xml
<!-- WRONG -->
<t t-foreach="mySet" t-as="x">...</t>
```

**Fix:** spread:

```xml
<t t-foreach="[...mySet]" t-as="x" t-key="x.id">...</t>
```

## 21. Slot content that expects `this` to be the child

**Source:** `slots.md`.

Slot content is rendered with the **parent's** context, not the child's. `t-on-click="handleIt"` inside a slot refers to `handleIt` on the parent.

## 22. Fallback slot that can throw

**Source:** `error_handling.md`.

An `onError` handler that sets state to render a fallback that itself throws → infinite loop. Keep the fallback UI inert.

## 23. Relying on `onError` to catch event-handler errors

**Source:** `error_handling.md`.

`onError` catches render and lifecycle errors only. Event-handler errors are your own responsibility — wrap in `try/catch` when the failure would corrupt state.

## 24. Calling `willStart` for optional work

**Source:** `concurrency_model.md` (verbatim tip).

_"Minimize the use of asynchronous components!"_ Move optional / expensive work to `onMounted`. The initial paint happens sooner.

## 25. Multi-block component without an SVG root when rendering SVG

**Source:** `templates.md`.

OWL uses a heuristic to set the SVG namespace: _"if a tag is either `svg`, `g` or `path`, then it will be considered as svg."_ If your component renders SVG, its template root must be one of those tags. Otherwise attributes get the wrong namespace.

## 26. Tag or attribute starting with `block-`

**Source:** `templates.md`.

_"Owl templates forbid the use of tag and or attributes starting with the `block-` string."_ Reserved for OWL's compiled blocks.

## 27. Depending on the `__owl__` internal field in production

**Source:** `reactivity.md`.

Reading `component.__owl__.subscriptions` is for debugging only. _"Should not be used in any type of production code as the name of this property or any of its properties or methods are subject to change at any point."_

## 28. Reading `ref.el` outside the mounted phase

**Source:** `refs.md`, `hooks.md`.

```js
// WRONG
setup() {
  const input = useRef("input");
  input.el.focus();  // el is null here
}
```

**Fix:** access `.el` in `onMounted`, `onPatched`, or event handlers:

```js
setup() {
  this.inputRef = useRef("input");
  onMounted(() => this.inputRef.el?.focus());
}
```

## 29. Forgetting to destroy secondary roots

**Source:** `app.md`.

`app.createRoot(...)` gives you a root whose lifetime you must manage yourself — call `root.destroy()` **before** removing its target from the DOM.

## 30. `dev: true` in production builds

**Source:** `app.md`.

Dev mode adds validation and wrappers that are fine for development but cost performance. Gate them on a build-time flag.
