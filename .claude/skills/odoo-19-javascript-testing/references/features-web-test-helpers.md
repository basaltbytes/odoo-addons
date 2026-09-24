# Web Test Helpers

Use `@web/../tests/web_test_helpers` when the test needs a real Odoo web env, started
services, a mock server, or convenient helpers for component and view mounting.

## Core imports

```js
import {expect, test} from "@odoo/hoot";
import {
  contains,
  getMockEnv,
  makeMockEnv,
  mountView,
  mountWithCleanup,
} from "@web/../tests/web_test_helpers";
```

## `makeMockEnv`: lowest useful Odoo layer

`makeMockEnv()` creates an `env`, starts registered services, starts a mock server if
needed, initializes non-service features like the router, and guarantees teardown at
test end.

Use it for:

- service tests
- low-level env-dependent helpers
- logic that is below the component layer

```js
test("creates a fully started env", async () => {
  const env = await makeMockEnv();

  expect(env.isSmall).toBe(false);
});
```

Rules:

- only one env can be active per test
- use `getMockEnv()` to retrieve the current env instead of creating another one

## `mountWithCleanup`: single-component tests

`mountWithCleanup(Component, params?)` mounts one Owl component into the test DOM, and
will prepare an env internally if none exists yet. Because that env creation also starts
the mock server, component tests can still rely on services and RPCs.

```js
await mountWithCleanup(Checkbox, {
  props: {
    value: false,
  },
});
```

Important rule from the docs: do not treat the returned component instance as the main
assertion surface. The accepted exception is when the component renders information that
is hard to observe through normal DOM assertions, such as a canvas-based graph.

Default posture:

- mount component
- interact through DOM
- assert through DOM

## `mountView`: view-level tests

`mountView(params)` is the view-specific convenience wrapper over `mountWithCleanup`. It
is the right default for list/form/kanban/calendar/graph tests.

```js
await mountView({
  type: "list",
  resModel: "res.partner",
  arch: /* xml */ `
    <list>
      <field name="display_name" />
    </list>
  `,
});
```

Useful properties typically include:

- `type`
- `resModel`
- `arch`

Like the lower helpers it builds on, `mountView` guarantees that both an env and a mock
server exist for the current test.

## `contains`: stable interaction for complex UI

Raw Hoot helpers act immediately and only wait a microtask after dispatched events. That
is often too low-level for Odoo views and the WebClient, where UI pieces may appear
later and updates usually need at least one animation frame.

That is what `contains(selector)` is for.

```js
await contains(".o_field_widget[name=name]").edit("Gaston Lagaffe");
await contains(".btn:contains(Save)").click();
expect(".o_field_widget[name=name]").toHaveText("Gaston Lagaffe");
```

Why this matters:

- it waits for the target element to exist
- it waits long enough for the UI to repaint after the interaction
- it is explicitly recommended for more complex units such as views, the WebClient, and
  service/component interactions

Do not make `contains` the default for every test interaction. It intentionally ignores
exact timing, so use raw Hoot helpers when the timing itself is part of the behavior
under test.

## Picking the right helper fast

| Need                                          | Helper                              |
| --------------------------------------------- | ----------------------------------- |
| started env + services, no UI                 | `makeMockEnv`                       |
| single component                              | `mountWithCleanup`                  |
| Odoo view behavior                            | `mountView`                         |
| eventually-present UI or WebClient-like flows | `contains` on top of the mounted UI |

## Sources

- https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/web_helpers.html
