---
name: features-client-actions-and-shared-state
description: Tutorial-derived patterns for systray widgets, popover client actions, command-palette actions, shared service state, reactive frontend models, and browser-backed persistence.
---

# Client Actions and Shared State

Use this when the same frontend state must power a systray item, a client action, command-palette actions, notifications or effects, or lightweight browser-only persistence.

## Promote shared state to a service early

The clicker tutorial's durable pattern is:

1. keep shared state out of systray or client-action components;
2. expose it from a service;
3. subscribe to it in each component with a tiny custom hook.

```js
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export function useClicker() {
    const clicker = useService("clicker");
    useState(clicker); // if the service returns the reactive model itself
    return clicker;
}
```

If the service returns `{ state, ...methods }` instead of the model itself, subscribe to `useState(service.state)` and keep methods on the wrapper. Do not duplicate local component state just to mirror a service.

When the service already returns a reactive model, the custom hook can stay trivial:

```js
export function useClicker() {
    return useState(useService("awesome_clicker.clicker"));
}
```

## When logic grows, move it into a reactive model

A plain reactive object works for one counter. Once the service owns unlock levels, timers, rewards, or derived values, move that logic into a `Reactive` subclass and keep the service thin: instantiate the model, wire timers, return it.

The useful split from the tutorial is:

- model: domain state plus mutations;
- service: lifecycle, app-lifetime listeners, timers, persistence, and service-to-service wiring;
- component: rendering and user interaction.

## Keep UI-only effects out of the model

The tutorial's best architectural move is to have the model emit a local bus event when a milestone is reached, then let the service translate that event into UI behavior such as `effect.add(...)` or `notification.add(...)`.

That keeps the model reusable and testable: it knows "milestone reached", not "show rainbow man".

## Use popover client actions for small tools

When a tool should open without taking over the whole web client, launch the client action with `target: "new"`:

```js
this.action.doAction({
    type: "ir.actions.client",
    tag: "my_module.client_action",
    target: "new",
    name: "My Tool",
});
```

This is a good default for quick utilities launched from systray items or notifications.

## Command-palette actions are just another registry surface

The solved addon makes the command palette concrete instead of leaving it theoretical:

```js
registry.category("command_provider").add("clicker", {
    provide(env) {
        return [
            {
                name: "Buy 1 click bot",
                action() {
                    env.services["awesome_clicker.clicker"].buyBot("clickbot");
                },
            },
            {
                name: "Open Clicker Game",
                action() {
                    env.services.action.doAction({
                        type: "ir.actions.client",
                        tag: "awesome_clicker.client_action",
                        target: "new",
                        name: "Clicker Game",
                    });
                },
            },
        ];
    },
});
```

Use this when an action should be globally discoverable but does not deserve a persistent navbar control.

## Small counter UX pattern: humanize, then preserve precision in a tooltip

`humanNumber(...)` keeps counters readable, but the tutorial's caveat is easy to miss: a tooltip needs a real DOM element. A text-node-only component cannot carry `data-tooltip`.

```xml
<span t-att-data-tooltip="String(props.value)">
    <t t-esc="humanNumber(props.value)"/>
</span>
```

## Persist browser-only state through the browser facade

For local browser persistence, use `@web/core/browser/browser`, not `window.localStorage` directly, so tests can mock it cleanly.

```js
import { browser } from "@web/core/browser/browser";

const STORAGE_KEY = "my_module.state";
const CURRENT_VERSION = 2;

export function loadState(migrate) {
    const raw = browser.localStorage.getItem(STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : { version: CURRENT_VERSION };
    return migrate(state);
}

export function saveState(state) {
    browser.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

The high-value caveat is not "use localStorage"; it is "version persisted state from day 1". Once browser state survives deploys, shape changes become migrations.

## Let surface widgets stay UI-only

As the systray surface grows, compose it with Odoo UI primitives instead of pushing more behavior into the navbar item itself:

- use `Dropdown` when the systray item becomes a menu of counters and quick actions;
- use `Notebook` when a client action starts mixing multiple subflows in one panel;
- if a patch is only an entry point, keep the patch thin and call back into a service or model.
