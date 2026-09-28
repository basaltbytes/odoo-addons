# Templates & QWeb directives

Sources: `templates.md`, `event_handling.md` (for `t-on-*`), `input_bindings.md` (for `t-model`).

OWL uses **QWeb**, an XML-based templating language, compiled in the browser into block-based render functions. Each directive is prefixed with `t-`. The placeholder `<t>` element runs directives without producing output itself.

## Directive tables (verbatim from `templates.md`)

### Standard QWeb

| Name | Description |
| ---- | ---- |
| `t-esc` | Output a value, escaped |
| `t-out` | Output a value — HTML-injected only if the value is `markup(...)`, otherwise behaves like `t-esc` |
| `t-set`, `t-value` | Set a variable (rendering-time) |
| `t-if`, `t-elif`, `t-else` | Conditional rendering |
| `t-foreach`, `t-as` | Loops |
| `t-att`, `t-attf-*`, `t-att-*` | Dynamic attributes |
| `t-call` | Render a sub-template |
| `t-debug`, `t-log` | Debugging |
| `t-translation` | Disable translation of a node |
| `t-translation-context` | Translation context for a node |
| `t-translation-context-*` | Translation context for a specific attribute |

### OWL-specific

| Name | Description |
| ---- | ---- |
| `t-component`, `t-props` | Define a sub-component (dynamic class / dynamic props object) |
| `t-ref` | Reference a DOM node |
| `t-key` | Key for virtual-DOM reconciliation |
| `t-on-*` | Event handling |
| `t-portal` | Render elsewhere in the document (see `portal.md`) |
| `t-slot`, `t-set-slot`, `t-slot-scope` | Slot system |
| `t-model` | Two-way input binding |
| `t-tag` | Dynamic tag names |
| `t-custom-*` | Custom directive hook (`customDirectives` on the `App`) |

`t-raw` was removed in OWL 2 — use `t-out` with `markup(...)` instead (CHANGELOG).

## Whitespace rules

- Consecutive whitespaces collapse into a single whitespace.
- A whitespace-only text node containing a line break is ignored.
- These rules do NOT apply inside `<pre>` elements.

## Expression evaluation

Expressions in QWeb are compiled: each variable becomes a lookup in the rendering context. `a + b.c(d)` compiles to roughly `context["a"] + context["b"].c(context["d"])`. Rules:

1. The expression must be a simple expression returning a value — not a statement.
2. You can reference anything in the rendering context; component members can be accessed either directly (`state.value`) or via `this.` (`this.state.value`).
3. Because XML dislikes some symbols, QWeb allows textual equivalents:

| Word | Replaced with |
|------|---------------|
| `and` | `&&` |
| `or`  | `\|\|` |
| `gt`  | `>` |
| `gte` | `>=` |
| `lt`  | `<` |
| `lte` | `<=` |

## Outputting data

### `t-esc`

Always escapes, safe for untrusted input:

```xml
<p><t t-esc="value"/></p>
```

The Odoo 19 tutorial notes: _"The `t-esc` directive can still be used in Owl templates. It is slightly faster than `t-out`."_ (tutorial ch.1).

### `t-out` and `markup`

`t-out` behaves like `t-esc` unless the value was produced by `markup`, in which case the value is injected as HTML. From `templates.md`:

```js
import { markup, Component, xml } from "@odoo/owl";

class SomeComponent extends Component {
  static template = xml`
    <t t-out="value1"/>
    <t t-out="value2"/>`;

  value1 = "<div>some text 1</div>";
  value2 = markup("<div>some text 2</div>");
}
```

> _"The first `t-out` will act as a `t-esc` directive... However, since `value2` has been tagged as a markup, this will be injected as html."_

`markup` can be used as a tag function so interpolated values are escaped safely:

```js
const maliciousInput = "<script>alert('💥💥')</script>";
// <b>&lt;script&gt;alert(&#x27;💥💥&#x27;)&lt;/script&gt;</b>
const value = markup`<b>${maliciousInput}</b>`;
```

### `t-set` / `t-value`

With `t-value`, evaluated at render time:

```xml
<t t-set="foo" t-value="2 + 1"/>
<t t-esc="foo"/>  <!-- "3" -->
```

Without `t-value`, the body becomes the value:

```xml
<t t-set="foo">
  <li>ok</li>
</t>
<t t-esc="foo"/>
```

Variables set with `t-set` are lexically scoped and can shadow outer names.

## Conditionals — `t-if`, `t-elif`, `t-else`

Applies to the bearer element, not necessarily a `<t>`:

```xml
<div>
  <p t-if="user.birthday == today()">Happy birthday!</p>
  <p t-elif="user.login == 'root'">Welcome master!</p>
  <p t-else="">Welcome!</p>
</div>
```

## Loops — `t-foreach` / `t-as` / `t-key`

```xml
<t t-foreach="[1, 2, 3]" t-as="i" t-key="i">
  <p><t t-esc="i"/></p>
</t>
```

Supported iterables: the canonical statement in `templates.md` is _"the `t-foreach` directive only accepts arrays (lists) or objects. It does not work with other iterables, such as `Set`. However, it is only a matter of using the `...` javascript operator."_ An earlier paragraph in the same doc also describes dedicated key/value semantics for objects and Maps, so Map iteration does work in practice (see the `$as_value` variable description below). To be safe and explicit, spread Sets and, if in doubt about an iterable, spread it to an array:

```xml
<t t-foreach="[...mySet]" t-as="item" t-key="item.id">…</t>
```

Iteration variables (where `$as` is the `t-as` name):

- `$as_value` — current value (identical to `$as` for arrays; the value for objects/maps).
- `$as_index` — 0-based index.
- `$as_first` — `$as_index == 0`.
- `$as_last` — `$as_index + 1 == $as_size` (requires the iteratee's size to be known).

Variables created inside a `t-foreach` are scoped to the loop; pre-existing variables that are reassigned inside the loop keep their new value after the loop (but newly declared ones do not leak):

```xml
<t t-set="existing_variable" t-value="false"/>

<p t-foreach="Array(3)" t-as="i" t-key="i">
  <t t-set="existing_variable" t-value="true"/>
  <t t-set="new_variable" t-value="true"/>
</p>

<!-- existing_variable now true; new_variable undefined here -->
```

### `t-key` — this is load-bearing

From `templates.md`:

> _"An important difference should be made with the usual `QWeb` behaviour: Owl requires the presence of a `t-key` directive, to be able to properly reconcile renderings. … The `t-key` directive is useful for lists (`t-foreach`). A key should be a unique number or string (objects will not work: they will be cast to the `\"[object Object]\"` string, which is obviously not unique). If there is no `t-key` directive, Owl will use the index as a default key."_

The key can be placed on the `t` element or on the body element (three equivalent forms in the doc):

```xml
<p t-foreach="items" t-as="item" t-key="item.id">
  <t t-esc="item.text"/>
</p>

<t t-foreach="items" t-as="item" t-key="item.id">
  <p t-esc="item.text"/>
</t>

<t t-foreach="items" t-as="item">
  <p t-key="item.id" t-esc="item.text"/>
</t>
```

Using the index as a key is fine only if the list is append-only and order-stable. Otherwise it causes DOM state to be attached to the wrong element (focus, selection, scroll, animations). See `antipatterns.md`.

## Dynamic attributes

- `t-att-NAME="expr"` — set `NAME` to the value of `expr`. A **falsy result removes the attribute entirely** (it is NOT set to "false"):

  ```xml
  <div t-att-data-action-id="id"/>  <!-- id = 32 → <div data-action-id="32"></div> -->
  <div t-att-foo="false"/>          <!-- <div></div> -->
  ```

- `t-attf-NAME="literal with {{expr}} or #{expr}"` — interpolation form:

  ```xml
  <div t-attf-foo="a {{value1}} is #{value2} of {{value3}}"/>
  ```

- `t-att="expr"` — fully dynamic name. Accepts an object map or a `[key, value]` pair:

  ```xml
  <div t-att="{'a': 1, 'b': 2}"/>   <!-- <div a="1" b="2"></div> -->
  <div t-att="['a', 'b']"/>          <!-- <div a="b"></div> -->
  ```

### `t-att-class` — object notation

`t-att-class` has special support for an object map where space-separated keys are allowed:

```xml
<div t-att-class="{'a': true, 'b': true}"/>    <!-- class="a b" -->
<div t-att-class="{'a b': true, 'c': true}"/>  <!-- class="a b c" -->
<div class="a" t-att-class="{'b': true}"/>     <!-- class="a b" -->
```

The tutorial underlines this (ch.1): _"Owl let you combine static class values with dynamic values."_

Note: OWL 2 does NOT have an equivalent object syntax for `t-att-style`.

## Dynamic tag — `t-tag`

```xml
<t t-tag="tag">
  <span>content</span>
</t>
```

If `tag` evaluates to `"div"`, this renders `<div><span>content</span></div>`.

## Sub-templates — `t-call` / `t-call-context`

A sub-template is inlined in the caller's scope (but its own set variables stay local):

```xml
<div t-name="other-template">
  <p><t t-esc="var"/></p>
</div>

<div t-name="main-template">
  <t t-set="var" t-value="owl"/>
  <t t-call="other-template"/>
</div>
```

The body of `t-call` is exposed as a magic variable `0` inside the called template:

```xml
<t t-name="other-template">
  called with:
  <t t-out="0"/>
</t>

<div t-name="main-template">
  <t t-call="other-template">
    <em>content</em>
  </t>
</div>
```

Scoped variables can be declared via nested `t-set` in the call body; those names are visible only inside the called template.

Alternate context via `t-call-context`:

```xml
<t t-call="other-template" t-call-context="obj"/>
```

Dynamic template names:

```xml
<div t-name="main-template">
  <t t-call="{{template}}">
    <em>content</em>
  </t>
</div>
```

## Debugging directives

- `t-debug` — injects a `debugger;` at render time.
- `t-log="expr"` — evaluates and `console.log`s at render time.

```xml
<t t-if="a_test">
  <t t-debug=""/>
</t>

<t t-set="foo" t-value="42"/>
<t t-log="foo"/>
```

## Custom directives

`App` config accepts `customDirectives`, which enables arbitrary `t-custom-*` directives that transform the element at compile time (`templates.md`):

```js
new App(Root, {
  customDirectives: {
    test_directive(el, value) {
      el.setAttribute("t-on-click", value);
    },
  },
});
```

```xml
<div t-custom-test_directive="click"/>
<!-- becomes <div t-on-click="click"/> at compile time -->
```

## Fragments

OWL 2 supports arbitrary root structures (none of these used to be legal in OWL 1.x):

```xml
hello owl. This is just a text node!
```

```xml
<div>hello</div>
<div>ola</div>
```

```xml
<t t-if="someCondition"><SomeChildComponent/></t>
```

## SVG and the tag heuristic

`templates.md` explains why SVG is tricky:

> _"Owl needs to properly set the namespace for each svg elements. Since Owl compile each template separately, it is not able to determine easily if a template is supposed to be included in a svg namespace or not. Therefore, Owl depends on a heuristic: if a tag is either `svg`, `g` or `path`, then it will be considered as svg. In practice, this means that each component or each sub templates (included with `t-call`) should have one of these tag as root tag."_

Practical rule: if your component outputs SVG, its template's outermost element must be `<svg>`, `<g>`, or `<path>`.

Example (verbatim from `templates.md`):

```js
class Node extends Component {
  static template = xml`
    <g>
      <circle t-att-cx="props.x" t-att-cy="props.y" r="4" fill="black"/>
      <text t-att-x="props.x - 5" t-att-y="props.y + 18">
        <t t-esc="props.node.label"/>
      </text>
      <t t-set="childx" t-value="props.x + 100"/>
      <t t-set="height" t-value="props.height / (props.node.children || []).length"/>
      <t t-foreach="props.node.children || []" t-as="child">
        <t t-set="childy" t-value="props.y + child_index * height"/>
        <line t-att-x1="props.x" t-att-y1="props.y"
              t-att-x2="childx" t-att-y2="childy" stroke="black"/>
        <Node x="childx" y="childy" node="child" height="height"/>
      </t>
    </g>`;
  static components = { Node };
}
```

## Reserved names

> _"Owl templates forbid the use of tag and or attributes starting with the `block-` string. This restriction prevents name collision with the internal code of Owl."_ (`templates.md`)

## Inline templates via the `xml` helper

`xml` is a tagged template that registers the string in OWL's template cache and returns a unique id:

```js
import { Component, xml, mount } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`
    <div>
      <span t-if="somecondition">text</span>
      <button t-on-click="someMethod">Click</button>
    </div>`;
}

mount(MyComponent, document.body);
```

In Odoo, production templates should be defined in XML files with `t-name="addon.ComponentName"` so they can be translated (see `12_odoo_appendix.md`).

## Two-way input binding — `t-model` (`input_bindings.md`)

```xml
<div>
  <input t-model="state.text"/>
  <span t-esc="state.text"/>
</div>
```

Works with `<input>`, `<input type="checkbox">`, `<input type="radio">`, `<textarea>`, and `<select>`.

Modifiers:

| Modifier  | Description |
|-----------|-------------|
| `.lazy`   | Update on `change` instead of `input` |
| `.number` | Parse with `parseFloat` |
| `.trim`   | Trim the string |

## Portals — `t-portal` (`portal.md`)

Renders the subtree elsewhere in the DOM while keeping it logically attached to the component:

```js
class SomeComponent extends Component {
  static template = xml`
    <div>this is inside the component</div>
    <div t-portal="'body'">and this is outside</div>`;
}
```

The value is a CSS selector. A portal no longer transfers events through the DOM tree (that was OWL 1.x behaviour) — and OWL inserts an empty text node at the original location.
