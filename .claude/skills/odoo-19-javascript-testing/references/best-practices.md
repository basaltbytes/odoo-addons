# Best Practices

Use this file as the review pass after writing or debugging an Odoo 19 frontend test.

## Pick the lowest layer that still proves behavior

| What you need to prove                         | Preferred tool                                |
| ---------------------------------------------- | --------------------------------------------- |
| service or env behavior                        | `makeMockEnv`                                 |
| one Owl component                              | `mountWithCleanup`                            |
| view behavior                                  | `mountView`                                   |
| eventually-rendered or WebClient-style UI flow | `contains(...)`                               |
| server data, routes, or ORM shaping            | `defineModels`, `onRpc`, `MockServer.current` |

Reaching for `contains` or a full view mount too early usually makes the test slower and
blurrier than it needs to be.

## Assert on outputs, not implementation details

Default to these surfaces:

- DOM text, value, presence, and visibility
- recorded steps via `expect.step`
- observable RPC payloads
- mock server state when the behavior is explicitly server-side

Avoid:

- reading component internals from the object returned by `mountWithCleanup`
- testing a child component through a parent's private state
- depending on incidental call counts when a more direct DOM or step assertion exists

## Use the right waiting primitive

There are three different async categories in these tests:

1. Promises and normal async work
2. mocked timers (`advanceTime`, `advanceFrame`)
3. Owl DOM patching (`animationFrame` or helpers built on it)

Common failure pattern:

- click something
- wait a microtask
- assert too early

Preferred fix:

- use `contains(...).click()` for complex Odoo UI
- or use raw Hoot interaction plus an explicit animation-frame wait

## Treat mock data as startup data unless you mutate through the server

Non-obvious rule that causes a lot of confusion:

- `_records` seeds initial data only
- `_views` sets the arches the mock server will serve
- after the server starts, mutate through the server instance or the UI, not by
  reassigning `_records`

If the test must simulate an external actor changing the database, use
`MockServer.current.env[model]...` and then trigger whatever client-side refresh the
production code would normally use.

## Prefer extension over replacement in `onRpc`

When you want to observe or tweak default ORM behavior, prefer:

```js
onRpc("web_read", async ({parent}) => {
  const result = parent();
  result.some_meta_data = {foo: "bar"};
  return result;
});
```

This is less brittle than replacing the whole route response from scratch.

## Fast review checklist

- the test uses the lowest viable layer
- the env or mock server is not spawned twice for the same test
- DOM assertions verify user-visible behavior
- `contains` is only used where eventual rendering matters
- Owl render waiting is explicit
- `_records` is only used for initial data
- `onRpc` handlers use `parent()` when extending existing behavior
- `expect.step` is used for sequencing-sensitive contracts

## Sources

- https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/hoot.html
- https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/web_helpers.html
- https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/mock_server.html
