# Props — declaration, validation, and the `.bind`/`.alike`/`.translate` suffixes

Source: `props.md`.

## What props are

> _"In Owl, `props` (short for _properties_) is an object which contains every piece of data given to a component by its parent."_ (`props.md`)

```js
class Child extends Component {
  static template = xml`<div><t t-esc="props.a"/><t t-esc="props.b"/></div>`;
}

class Parent extends Component {
  static template = xml`<div><Child a="state.a" b="'string'"/></div>`;
  static components = { Child };
  state = useState({ a: "fromparent" });
}
```

`props.a` is `"fromparent"`; `props.b` is `"string"`.

### What is and isn't a prop

> _"The `props` object is made of every attributes defined on the template, with the following exceptions: every attribute starting with `t-` are not props (they are QWeb directives)."_

```xml
<div>
  <ComponentA a="state.a" b="'string'"/>
  <ComponentB t-if="state.flag" model="model"/>
</div>
```

`ComponentA` receives `{a, b}`. `ComponentB` receives `{model}`. `t-if` is a directive, not a prop.

## Props are read-only for the child

> _"Props should be considered readonly, from the perspective of the child component. If there is a need to modify them, then the request to update them should be sent to the parent (for example, with an event)."_ (`props.md`)

Anti-pattern called out verbatim:

```js
class MyComponent extends Component {
  constructor(parent, props) {
    super(parent, props);
    props.a.b = 43; // Never do that!!!
  }
}
```

## The shallow-equality re-render check

> _"Whenever Owl encounters a subcomponent in a template, it performs a shallow comparison of all props. If they are all referentially equal, then the subcomponent will not even be updated. Otherwise, if at least one props has changed, then Owl will update it."_ (`props.md`)

This is the core of OWL 2's performance model. It has two direct consequences:

1. An **anonymous function** passed as a prop is a new reference every render, so the shallow check fails. The child re-renders every time the parent renders.
2. A **reactive object** passed as a prop keeps its reference, but the child then "reobserves" it (see `02_reactivity.md`), so fine-grained re-renders still happen even when the outer prop object is stable.

## `.bind` — bind a method to the parent

```js
class SomeComponent extends Component {
  static template = xml`
    <div>
      <Child callback.bind="doSomething"/>
    </div>`;

  doSomething() {
    // ...
  }
}
```

`callback.bind="doSomething"` passes `this.doSomething` pre-bound. **`.bind` implies `.alike`**, so the child does not treat the callback as a changed prop across renders.

## `.alike` — treat the expression as equivalent across renders

Use for lambdas that are safe to treat as stable even though the function identity differs:

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <Todo todo="todo" onDelete.alike="() => deleteTodo(todo.id)"/>
</t>
```

Anti-pattern called out in `props.md`:

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <!-- Probably wrong! todo.isCompleted may change -->
  <Todo todo="todo" toggle.alike="() => toggleTodo(todo.isCompleted)"/>
</t>
```

The captured `todo.isCompleted` is stale between renders; `.alike` prevents the child from seeing the updated lambda. If the child depends on this value, remove `.alike`, or change the design so the value comes from reactive state that the child reads directly.

## `.translate` — translate a prop at compile time

```xml
<t t-name="ParentComponent">
  <Child someProp.translate="some message"/>
</t>
```

> _"The content of this attribute is **NOT** treated as a JavaScript expression: it is treated as a string… and translated before being passed to the component."_

## `t-props` — pass a full props object

```xml
<div t-name="ParentComponent">
  <Child t-props="some.obj"/>
</div>
```

## Default props

```js
class Counter extends Component {
  static defaultProps = {
    initialValue: 0,
  };
}
```

Rule: **default values cannot be defined for a mandatory prop.** Doing so raises a validation error.

## Props validation — full rules (verbatim)

> - `props` key is a static key (so, different from `this.props` in a component instance)
> - it is optional: it is ok for a component to not define a `props` key.
> - props are validated whenever a component is created/updated
> - props are only validated in `dev` mode (see how to configure an app)
> - if a key does not match the description, an error is thrown
> - it validates keys defined in (static) `props`. Additional keys given by the parent will cause an error (unless the special prop `*` is present).
> - it is an object or a list of strings
> - a list of strings is a simplified props definition, which only lists the name of the props. Also, if the name ends with `?`, it is considered optional.
> - all props are by default required, unless they are defined with `optional: true` (in that case, it is only done if there is a value)
> - valid types are: `Number, String, Boolean, Object, Array, Date, Function`, and all constructor functions (so, if you have a `Person` class, it can be used as a type)
> - arrays are homogeneous (all elements have the same type/shape)

### Prop-entry shapes

For each key, the definition is one of:

- **Boolean** — means the prop exists and is mandatory.
- **Constructor** — the type (e.g. `Number`, `String`, or a class like `Person`).
- **Value object** — `{ value: false }` means the prop must equal `false`.
- **Constructor array** — `[Number, String]` means the prop is one of those types.
- **Full object** with sub-keys (all optional):
  - `type` — the main type.
  - `element` — if `type` is `Array`, describes each element.
  - `shape` — if `type` is `Object`, describes the interface.
  - `values` — if `type` is `Object`, describes the interface of values in a mapping object.
  - `validate(value) -> boolean` — custom validator.
  - `optional: true` — makes the prop non-mandatory.

There is a special `*` escape that allows extra props beyond those declared.

### Examples (verbatim)

```js
class ComponentA extends Component {
  static props = ["id", "url"];
}

class ComponentB extends Component {
  static props = {
    count: { type: Number },
    messages: {
      type: Array,
      element: { type: Object, shape: { id: Boolean, text: String } },
    },
    date: Date,
    combinedVal: [Number, Boolean],
    optionalProp: { type: Number, optional: true },
  };
}
```

```js
// only documents the existence of those 3 keys
static props = ['message', 'id', 'date'];
```

```js
// any other key is also allowed
static props = ['message', 'id', 'date', '*'];
```

```js
// size is optional (trailing '?')
static props = ['message', 'size?'];
```

```js
static props = {
  messageIds: { type: Array, element: Number },  // array of number
  otherArr: { type: Array },                     // array, no element validation
  otherArr2: Array,                              // same as otherArr
  someObj: { type: Object },                     // object, no internal validation
  someObj2: {
    type: Object,
    shape: {
      id: Number,
      name: { type: String, optional: true },
      url: String,
    },
  },
  someObj3: {
    type: Object,
    values: { type: Array, element: String },    // arbitrary keys → String[]
  },
  someFlag: Boolean,
  someVal: [Boolean, Date],
  otherValue: true,                              // mere existence
  kindofsmallnumber: {
    type: Number,
    validate: (n) => 0 <= n && n <= 10,
  },
  size: {
    validate: (e) => ["small", "medium", "large"].includes(e),
  },
  someId: [Number, { value: false }],            // number OR literal false
};
```

### When validation is off

> _"props are only validated in `dev` mode."_

The `App` config has a `dev: true` option (`app.md`). In production, props validation is skipped for performance. Treat `static props` as documentation that is enforced only during development.

### `slots` is a prop

If a component uses slots **and** declares its props, you must allow the `slots` prop:

```js
class MyComponent extends Component {
  static props = ["someProp", "slots?"];
}

class MyComponentWithValidation extends Component {
  static props = {
    someProp: { type: Number, optional: true },
    slots: { type: Object, optional: true },
  };
}
```

Or use `"*"` to accept unknown props generally.

### `warnIfNoStaticProps`

`App` configuration accepts `warnIfNoStaticProps: true` (`app.md`), which makes OWL log a warning in the console for any component that does not declare `static props`. Useful to enforce the convention _"It is a good practice to do props validation for every component"_ across an application (Odoo 19 tutorial ch.1).

## How validation tracks errors

From `props.md`: _"the props validation code is done by using the [validate utility function](utils.md#validate)."_ The top-level `validate` utility is also exported from `@odoo/owl` and can be called by hand against your own objects (useful for hook arguments).

```js
import { validate } from "@odoo/owl";

validate(
  { a: "hey" },
  {
    id: Number,
    url: [Boolean, { type: Array, element: Number }],
  }
);

// throws:
//   - unknown key 'a',
//   - 'id' is missing (should be a number),
//   - 'url' is missing (should be a boolean or list of numbers)
```
