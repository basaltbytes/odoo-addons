# Error handling and testing

Sources: `error_handling.md`, `learning/how_to_test.md`, `app.md` (`dev` mode), `learning/quick_start.md`.

## Error handling — what OWL catches and what it doesn't

From `error_handling.md`:

> _"By default, whenever an error occurs in the rendering of an Owl application, we destroy the whole application. Otherwise, we cannot offer any guarantee on the state of the resulting component tree. It might be hopelessly corrupted, but without any user-visible feedback."_

Concrete rules (verbatim):

- _"If an error that occured in the internal rendering cycle is not caught, then Owl will destroy the full application."_
- _"Errors coming from event handlers are NOT managed by `onError` or any other owl mechanism. This is up to the application developer to properly recover from an error."_
- _"If an error handler is unable to properly handle an error, it can just rethrow an error, and Owl will try looking for another error handler up the component tree."_

So `onError` only catches errors that happen:

- during rendering (template evaluation)
- in lifecycle hooks (`willStart`, `willUpdateProps`, `mounted`, `patched`, `willUnmount`, `willDestroy`)
- propagating up from descendant components

Errors thrown inside an event handler (`t-on-click="someMethod"`) are not caught — wrap them yourself when the failure would corrupt your UI state.

## Error boundary pattern

The canonical pattern from `error_handling.md`:

```js
import { Component, useState, onError, xml } from "@odoo/owl";

class ErrorBoundary extends Component {
  static template = xml`
    <t t-if="state.error" t-slot="fallback">An error occurred</t>
    <t t-else="" t-slot="default"/>`;

  setup() {
    this.state = useState({ error: false });
    onError(() => (this.state.error = true));
  }
}
```

Usage:

```xml
<ErrorBoundary>
  <SomeOtherComponent/>
  <t t-set-slot="fallback">Some specific error message</t>
</ErrorBoundary>
```

Watch out: the fallback slot must not throw. _"Note that we need to be careful here: the fallback UI should not throw any error, otherwise we risk going into an infinite loop."_

See `examples/error_boundary.md` for a complete runnable version.

### When you need more detail in the handler

`onError` receives the thrown error. Log it, report it to a monitoring service, and set state to render a recovery UI. Example extension:

```js
onError((err) => {
  console.error("ErrorBoundary caught:", err);
  this.state.error = err;
});
```

Then render `<t t-out="state.error.stack"/>` in the fallback slot if useful.

### Rethrow to bubble

If the boundary can't handle a specific error class, rethrow:

```js
onError((err) => {
  if (!(err instanceof RecoverableError)) throw err;
  this.state.error = err;
});
```

OWL will look for the next `onError` up the tree. If nothing catches it, the app is destroyed.

## `OwlError`

OWL exports a branded error class (`readme.md` + `src/runtime/index.ts`):

```js
import { OwlError } from "@odoo/owl";
throw new OwlError("something unrecoverable");
```

Use for your own invariants — it reads clearly in the DevTools and in application monitoring dashboards.

## Testing components

Source: `learning/how_to_test.md`.

### Setup helpers

OWL's rendering is asynchronous and batched to animation frames, so any test helper has to wait **both** a microtask and a paint frame before asserting:

```js
let lastFixture = null;

export function makeTestFixture() {
  const fixture = document.createElement("div");
  document.body.appendChild(fixture);
  if (lastFixture) lastFixture.remove();
  lastFixture = fixture;
  return fixture;
}

export async function nextTick() {
  await new Promise((resolve) => setTimeout(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
```

### Test skeleton (Jest)

```js
import { mount } from "@odoo/owl";
import { SomeComponent } from "../../src/ui/SomeComponent";
import { makeTestFixture, nextTick } from "../helpers";

let fixture;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

describe("SomeComponent", () => {
  test("component behaves as expected", async () => {
    const props = { /* ... */ };
    const comp = await mount(SomeComponent, fixture, { props });

    expect(/* ... */).toBe(/* ... */);

    fixture.querySelector("button").click();
    await nextTick();

    expect(/* ... */).toBe(/* ... */);
  });
});
```

The doc notes: _"Owl does wait for the next animation frame to actually update the DOM. This is why it is necessary to wait with the `nextTick` (or other methods) to make sure that the DOM is up-to-date."_

### Triggering interactions

A minimal click helper from `quick_start.md`:

```js
export function click(elem, selector) {
  elem.querySelector(selector).dispatchEvent(new Event("click"));
}
```

Tests typically alternate: trigger → `await nextTick()` → assert → trigger → `await nextTick()` → assert.

### Using `dev: true` in tests

Mount with `{ dev: true }` (or `test: true`) to enable prop validation and loop-key checks while running tests:

```js
await mount(SomeComponent, fixture, { props, dev: true });
```

`test: true` behaves like `dev: true` but without the "running in dev mode" console warning (`app.md`), which is typically preferred in automated suites.

### Mocking the environment

Pass an `env` object at mount time to replace real services with test doubles:

```js
const env = {
  services: {
    rpc: () => Promise.resolve(fakeResponse),
    notification: { add() {} },
  },
};

await mount(SomeComponent, fixture, { env, dev: true });
```

The env is shallow-frozen (`environment.md`), so structure it at mount time — don't expect to mutate it mid-test.

### Testing reactive re-renders

Because each render clears and re-establishes subscriptions, you can verify re-renders happen (or don't) by flipping reactive state and asserting on DOM contents after `nextTick`:

```js
const state = reactive({ v: 1 });
class C extends Component {
  static template = xml`<div><t t-esc="state.v"/></div>`;
  setup() { this.state = useState(state); }
}

await mount(C, fixture, { dev: true });
expect(fixture.textContent.trim()).toBe("1");

state.v = 2;
await nextTick();
expect(fixture.textContent.trim()).toBe("2");
```

### Testing error boundaries

Mount the boundary around a component that throws from `willStart`:

```js
class Broken extends Component {
  static template = xml`<div/>`;
  setup() {
    onWillStart(() => { throw new Error("boom"); });
  }
}

class Container extends Component {
  static template = xml`
    <ErrorBoundary>
      <Broken/>
      <t t-set-slot="fallback">fallback ui</t>
    </ErrorBoundary>`;
  static components = { ErrorBoundary, Broken };
}

await mount(Container, fixture, { dev: true });
await nextTick();
expect(fixture.textContent).toMatch(/fallback ui/);
```

### What NOT to test

- Don't test OWL itself. If your test depends on internal VDOM shape or `__owl__.subscriptions`, you'll break on every minor OWL version.
- Don't test render counts — OWL's scheduler is allowed to coalesce and cancel renders. Test DOM outcomes, not the number of renders.
