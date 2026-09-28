# Example: Error boundary

Source: `error_handling.md` (verbatim).

An error boundary is a component that catches errors from its descendants via the `onError` hook and renders a fallback UI instead of crashing the whole app. OWL only catches render-cycle and lifecycle errors — event-handler errors are your own responsibility.

## Minimal boundary

```js
import { Component, useState, onError, xml } from "@odoo/owl";

export class ErrorBoundary extends Component {
  static template = xml`
    <t t-if="state.error" t-slot="fallback">An error occurred</t>
    <t t-else="" t-slot="default"/>`;

  setup() {
    this.state = useState({ error: false });
    onError(() => {
      this.state.error = true;
    });
  }
}
```

## Usage with custom fallback

```xml
<ErrorBoundary>
  <SomeOtherComponent/>
  <t t-set-slot="fallback">
    Something went wrong. <button t-on-click="retry">Retry</button>
  </t>
</ErrorBoundary>
```

Note the warning from the doc: _"the fallback UI should not throw any error, otherwise we risk going into an infinite loop."_ Keep the fallback inert — no async work, no risky computations, no state reads that might be corrupted.

## Capturing the error object

```js
setup() {
  this.state = useState({ error: null });
  onError((err) => {
    console.error("ErrorBoundary caught:", err);
    this.state.error = err;
  });
}
```

Template:

```xml
<t t-if="state.error" t-slot="fallback">
  <pre t-out="state.error.stack"/>
</t>
<t t-else="" t-slot="default"/>
```

## Selective handling — rethrow the rest

Not every error should be caught at every level. Rethrow to let OWL look for another handler up the tree:

```js
setup() {
  this.state = useState({ error: null });
  onError((err) => {
    if (!(err instanceof RecoverableError)) {
      throw err;        // bubble up
    }
    this.state.error = err;
  });
}
```

If nothing catches the error, OWL destroys the application — that is the default safety mechanism described in `error_handling.md`.

## What `onError` catches

- Errors thrown during a template's render function.
- Errors thrown from lifecycle hooks (`willStart`, `willUpdateProps`, `mounted`, `patched`, `willPatch`, `willUnmount`, `willDestroy`).
- Errors propagating from descendant components' render / lifecycle.

## What `onError` does NOT catch

- Errors in event handlers (`t-on-click="someMethod"`). Wrap them yourself:

  ```js
  onClick() {
    try {
      this.doSomething();
    } catch (err) {
      this.state.error = err;
    }
  }
  ```

- Errors in async callbacks scheduled from handlers (timers, promises). Handle per callback.

## Testing the boundary

```js
import { Component, xml, onWillStart } from "@odoo/owl";
import { ErrorBoundary } from "../src/error_boundary";
import { mount } from "@odoo/owl";
import { makeTestFixture, nextTick } from "./helpers";

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
      <t t-set-slot="fallback">fallback shown</t>
    </ErrorBoundary>`;
  static components = { ErrorBoundary, Broken };
}

test("boundary catches willStart errors", async () => {
  const fixture = makeTestFixture();
  await mount(Container, fixture, { dev: true });
  await nextTick();
  expect(fixture.textContent).toMatch(/fallback shown/);
});
```

## Placement strategy

- A single top-level boundary above the main UI gives you a graceful "app is broken" screen.
- Sub-tree-local boundaries (e.g. around a third-party embed, a lazily-loaded module, or a heavy widget) let the rest of the app keep working.
- Don't over-catch: every boundary hides bugs. Keep them at logical product boundaries, not sprinkled everywhere.
