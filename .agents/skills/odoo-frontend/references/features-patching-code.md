---
name: features-patching-code
description: Safe use of `patch(...)`, including prototype patching, `super`, top-level timing, and unpatch patterns for tests.
---

# Patching Code

Patch only when registries, services, hooks, or normal component composition are not enough.

## The supported API

```js
import { patch } from "@web/core/utils/patch";
```

`patch(objToPatch, extension)` mutates the target in place and returns an unpatch function.

## Patch early, not at runtime

The JavaScript reference is explicit: patches should be applied as soon as possible, at module top level. Late patching is dangerous because existing instances may already be alive.

```js
import { patch } from "@web/core/utils/patch";
import { SomeClass } from "@web/somewhere";

patch(SomeClass.prototype, {
  setup() {
    super.setup(...arguments);
    this.extraState = true;
  },
});
```

## Patch prototype methods, not the class, unless you mean static members

```js
patch(MyClass.prototype, {
  method() {
    super.method(...arguments);
  },
});
```

Patch the class itself only for static properties.

## `super` only works in methods

These are invalid in patch extensions:

- function expressions
- arrow functions

Use method syntax only.

## You cannot patch a constructor

If a class needs to stay patchable, it should delegate constructor logic into `setup()` or another method, then you patch that method. This is why Odoo components are expected to initialize in `setup()`.

## Extension objects are single-use

Because of how `super` is wired, do not spread or clone one extension object across multiple patch targets. If several objects need the same behavior, generate a fresh extension object per target.

## Unpatching is mainly for tests

```js
const unpatch = patch(object, {
  fn() {
    super.fn(...arguments);
  },
});

// ...test...
unpatch();
```

That pattern is the safe way to localize behavioral changes in tests.
