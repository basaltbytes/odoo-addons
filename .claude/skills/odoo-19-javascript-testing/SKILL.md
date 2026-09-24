---
name: odoo-19-javascript-testing
description:
  "Use when writing or debugging Odoo 19 frontend JavaScript tests: Owl component tests,
  service/env tests, view or WebClient interaction tests, mock RPC/model setup, or Hoot
  assertions and timing. Triggers include `@odoo/hoot`, `@odoo/hoot-dom`,
  `@web/../tests/web_test_helpers`, `makeMockEnv`, `mountWithCleanup`, `mountView`,
  `contains`, `defineModels`, `onRpc`, `MockServer`, `expect.step`, `advanceTime`, or
  requests to mock server state in Odoo tests. Not for Python backend tests or generic
  Jest/Vitest-only setups."
---

# Odoo 19 JavaScript Testing

Odoo 19 frontend tests are built from three layers: Hoot, web test helpers, and the mock
server. Pick the smallest layer that proves the behavior, assert through DOM output or
observable RPCs, and only reach into component instances when the UI cannot expose the
thing you need to verify.

## Quick Route

Do not read every reference up front. Load only the slice that matches the task.

| If the task is about...                                                                            | Read                                                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Test file structure, `test`/`expect`, DOM helpers, query helpers, `expect.step`, fake time         | [references/core-hoot.md](./references/core-hoot.md)                                 |
| `makeMockEnv`, `getMockEnv`, `mountWithCleanup`, `mountView`, or `contains`                        | [references/features-web-test-helpers.md](./references/features-web-test-helpers.md) |
| `defineModels`, `fields`, `_records`, `_views`, `onRpc`, `makeMockServer`, or `MockServer.current` | [references/features-mock-server.md](./references/features-mock-server.md)           |
| Choosing the right test layer, avoiding brittle tests, or doing a final review pass                | [references/best-practices.md](./references/best-practices.md)                       |

## Testing Ladder

Use this order unless the task clearly demands a higher layer:

1. `makeMockEnv` for service tests or low-level env-dependent logic.
2. `mountWithCleanup` for a single Owl component with realistic env/services.
3. `mountView` for list/form/kanban/calendar/graph view behavior.
4. `contains(...)` flows for eventually-rendered UI, view interactions, or
   WebClient-style tests.
5. `defineModels` / `onRpc` / `MockServer.current` when the server side is what needs to
   be shaped or observed.

## Rules That Matter

1. Prefer DOM assertions over reading component internals. `mountWithCleanup` and
   `mountView` do return instances, but that is an escape hatch.
2. Use `contains` only when eventual rendering is the point. It intentionally ignores
   precise timing details.
3. Use `expect.step` and `expect.verifySteps` when the contract is call order, RPC
   payload shape, or callback sequencing.
4. Hoot mocks timers and `Date`, but Owl rendering still needs an animation frame. Use
   `animationFrame`, `advanceFrame`, or helpers built on top of them.
5. Seed `_records` before the mock server starts. After startup, mutate data through the
   UI or `MockServer.current.env[...]`.
6. Assume one env and one mock server per test. Reuse the active one with `getMockEnv`
   or `MockServer.current` instead of spawning duplicates.

## Cross-Skill Guidance

This skill is about testing Odoo frontend code, not Owl authoring itself. If the task
also needs component API details, template rules, hooks, or state semantics, load the
[owl skill](../owl/SKILL.md) alongside this one.

## Sources

- [HOOT](https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/hoot.html)
- [Web test helpers](https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/web_helpers.html)
- [Mock server](https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/mock_server.html)
