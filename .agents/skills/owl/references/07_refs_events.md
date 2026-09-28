# Refs and events

Sources: `refs.md`, `event_handling.md`, `hooks.md` (`useRef`).

## Refs — DOM references only

OWL 2 refs point at DOM nodes, not component instances. `t-ref` on a sub-component is no longer supported (CHANGELOG: _"`t-ref` does not work on components"_).

```xml
<div>
  <input t-ref="input"/>
  <button t-on-click="focusInput">Click</button>
</div>
```

```js
import { useRef } from "@odoo/owl";

class SomeComponent extends Component {
  setup() {
    this.inputRef = useRef("input");
  }

  focusInput() {
    this.inputRef.el.focus();
  }
}
```

Timing rule (`refs.md`):

> _"Be aware that the `el` property will only be set when the target of the `t-ref` directive is mounted in the DOM. Otherwise, it will be set to `null`."_
> _"The `useRef` hook cannot be used to get a reference to an instance of a sub component."_

So:

- Access `.el` only inside `onMounted`, `onPatched`, or event handlers — places where the DOM exists.
- Don't use refs to call methods on children; pass callbacks through props / slots, or lift the state up.

### Dynamic ref names

`t-ref` accepts string interpolation (`hooks.md`):

```xml
<div t-ref="div_{{someCondition ? '1' : '2'}}"/>
```

```js
this.ref1 = useRef("div_1");
this.ref2 = useRef("div_2");
```

At any time only one of `ref1.el` / `ref2.el` is set.

## Events — `t-on-*`

```xml
<button t-on-click="someMethod">Do something</button>
```

Equivalent to (approximately):

```js
button.addEventListener("click", component.someMethod.bind(component));
```

### Allowed handler forms

Three valid shapes (`event_handling.md`):

```xml
<button t-on-click="someMethod">Bound method</button>
<button t-on-click="() => this.increment(3)">Inline arrow</button>
<button t-on-click="ev => this.doStuff(ev, 'value')">Arrow with event</button>
```

Note on lambdas: _"Notice the use of the `this` keyword in the lambda function: this is the correct way to call a method on the component in a lambda function."_ Writing `() => increment(3)` (no `this.`) can fail because the function may be unbound.

OWL 2 requires handlers to be **functions**. _"`t-on` does not accept expressions — only functions"_ (CHANGELOG). It throws otherwise.

An empty handler is still valid and useful with modifiers:

```xml
<button t-on-click.stop="">Do something</button>
```

### Modifiers (verbatim table)

| Modifier     | Description |
|--------------|-------------|
| `.stop`      | `event.stopPropagation()` before calling the handler |
| `.prevent`   | `event.preventDefault()` before calling the handler |
| `.self`      | Call the handler only when `event.target` is the bearer element itself |
| `.capture`   | Bind the handler in capture phase |
| `.synthetic` | Delegated handler on the document body — see performance note below |

Modifiers can be combined. **Order matters.** `t-on-click.prevent.self` prevents all clicks; `t-on-click.self.prevent` only prevents clicks on the element itself.

### Events on components

You can attach listeners on component tags:

```xml
<div>
  in some template
  <Child t-on-click="dosomething"/>
</div>
```

This catches clicks on any HTML element inside `Child`. If `Child` renders only text nodes, clicks will be dispatched on the parent (the `div`) and won't trigger the handler.

Note: OWL 2 no longer has custom component events triggered via `component.trigger`. Use callback props with `.bind` for parent-child communication.

## `.synthetic` — the performance modifier for large lists

Full verbatim text from `event_handling.md`:

> _"In some cases, attaching an event handler for each element of large lists has a non trivial cost. Owl provides a way to efficiently improve the performance: with synthetic event, it actually adds only one handler on the document body, and will properly call the handler, just as expected. The only difference with regular events is that the event is caught at the document body, so it cannot be stopped before it actually gets there. Since it may be surprising in some cases, it is not enabled by default."_

```xml
<div>
  <t t-foreach="largeList" t-as="elem" t-key="elem.id">
    <button t-on-click.synthetic="doSomething">
      <!-- some content -->
    </button>
  </t>
</div>
```

When to use: lists over ~100 rows where each row has the same handler and you don't need to stop propagation before it reaches the body. The browser only gets one `click` listener instead of hundreds.

## `useExternalListener(target, event, callback, options?)`

For listeners outside the component's own DOM (e.g., on `window` / `document`) use the hook so OWL manages the add/remove automatically:

```js
import { useExternalListener } from "@odoo/owl";

class MyDropdown extends Component {
  setup() {
    useExternalListener(window, "click", this.closeMenu, { capture: true });
  }

  closeMenu() { /* ... */ }
}
```

Lifetime: added when the component is about to be mounted, removed when it unmounts.

## Errors thrown from handlers

Errors in rendering are caught by `onError` — but errors in event handlers are **not** (`error_handling.md`): _"errors coming from event handlers are NOT managed by `onError` or any other owl mechanism. This is up to the application developer to properly recover from an error."_ Wrap handler bodies in `try/catch` when the failure mode would leave the UI inconsistent.
