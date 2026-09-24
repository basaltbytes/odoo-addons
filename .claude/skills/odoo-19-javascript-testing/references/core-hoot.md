# Hoot Core

Use Hoot for the testing primitives themselves: `test`, `describe`, `expect`, DOM query
and interaction helpers, and fake time.

## Imports and module boundaries

Odoo 19 exposes two related modules:

- `@odoo/hoot-dom` for DOM helpers such as `click`, `press`, `queryAll`, and `waitFor`.
- `@odoo/hoot` for the test framework itself, plus re-exports of the DOM helpers for
  unit tests.

Start most Odoo test files with:

```js
import {expect, test} from "@odoo/hoot";
```

Add `describe`, `afterEach`, `advanceTime`, `click`, or other helpers only when needed.

## Baseline test shape

```js
import {click, expect, getFixture, test} from "@odoo/hoot";

test("increments the counter", async () => {
  const fixture = getFixture();
  fixture.innerHTML = `<button>0</button>`;

  fixture.querySelector("button").addEventListener("click", (ev) => {
    ev.currentTarget.textContent = "1";
  });

  await click("button");

  expect("button").toHaveText("1");
});
```

Useful mental model:

- Each test file already runs in an isolated top-level `describe`.
- Add sub-suites only when the file needs extra grouping or tags.
- Prefer DOM matchers such as `toHaveText` and `toHaveValue` over hand-written
  `querySelector(...).textContent` checks.

## Use `expect.step` for call sequencing

`expect.step` and `expect.verifySteps` are better than raw assertion counts when the
contract is "what happened, and in what order".

```js
import {expect, test} from "@odoo/hoot";

test("records RPC order", async () => {
  expect.step("before");
  expect.step(["web_read", [1, 2]]);

  expect.verifySteps(["before", ["web_read", [1, 2]]]);
});
```

Good uses:

- verify RPC ordering
- verify callback chaining
- capture IDs or arguments seen by `onRpc`
- assert that a side effect happened exactly once

Related helpers:

- `expect.verifyErrors(...)` to assert captured errors
- `expect.waitForErrors(...)` when an error is expected later in the async flow

## Hoot time is fake, Owl rendering is not

Hoot mocks timers, `Date`, and `performance`, but two things still matter:

- Promises are not time-mocked.
- Owl rendering still needs an animation frame.

So there are two distinct waiting strategies:

1. Use `advanceTime(ms)` or `advanceFrame(count)` for timers.
2. Use `animationFrame()` when you need Owl-rendered DOM to settle.

```js
import {advanceTime, expect, test} from "@odoo/hoot";

test("flushes a timeout without sleeping", async () => {
  setTimeout(() => expect.step("tick"), 1000);

  await advanceTime(1000);

  expect.verifySteps(["tick"]);
});
```

If an assertion depends on Owl patching the DOM, do not assume that flushing a microtask
is enough.

## DOM helpers to keep in reach

These are the Hoot helpers that most often matter in Odoo tests:

- `click`, `dblclick`, `hover`, `press`, `drag`, `scroll`, `select`
- `queryAll` for a DOM snapshot right now
- `waitFor` when the element may appear later
- `getFixture` for low-level fixture access

Use raw Hoot DOM helpers when you need precise event timing or exact event sequences.
For eventually-rendered Odoo UI, the higher-level `contains` helper from web test
helpers is often a better fit.

## Review checklist

- Import from `@odoo/hoot` unless you specifically need the tour-safe `@odoo/hoot-dom`
  split.
- Use `expect.step` for sequencing, not ad hoc counters.
- Separate timer waiting from Owl render waiting.
- Prefer DOM assertions over internal object state.

## Sources

- https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/hoot.html
