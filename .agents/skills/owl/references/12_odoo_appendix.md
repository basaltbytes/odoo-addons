# Odoo 19 — OWL integration appendix

Sources: Odoo 19 official docs (`owl_components.html`, `framework_overview.html`, `discover_js_framework/01_owl_components.html`, `discover_js_framework/02_build_a_dashboard.html`, `howtos/standalone_owl_application.html`).

This file documents the small set of Odoo-specific conventions that affect OWL code. For everything about OWL itself, see the other references.

## Version

Odoo 19 ships OWL **2.8.2** (verified by inspecting `addons/web/static/lib/owl/owl.js` on the `19.0` branch — the bundle contains `const version = "2.8.2";`). Odoo has standardised on a single OWL version across its supported releases: _"Currently, all Odoo versions (starting in version 14) share the same Owl version."_ (`owl_components.html`).

## Importing OWL inside Odoo

```js
import { Component, useState, onMounted, xml } from "@odoo/owl";
```

OWL is also exposed as a global `owl` object for non-module contexts:

> _"Owl is available as a library in the global namespace as `owl`: it can simply be used like most libraries in Odoo."_

## Template name convention

> _"Template names should follow the convention `addon_name.ComponentName`. This prevents name collision between odoo addons."_ (`owl_components.html`)

File layout recommendation:

```
your_module/static/src/my_component/
├── my_component.js
├── my_component.xml     <- <t t-name="your_module.MyComponent">
└── my_component.scss    <- optional
```

And the component:

```js
import { Component } from "@odoo/owl";

export class MyComponent extends Component {
  static template = "your_module.MyComponent";
}
```

The XML file:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<templates xml:space="preserve">
  <t t-name="your_module.MyComponent">
    <div>…</div>
  </t>
</templates>
```

Inline `xml\`…\`` templates are fine for prototyping. For real modules, use XML files so Odoo can translate them (_"templates in Odoo should be defined in an xml file, so they can be translated"_, `owl_components.html`).

## Constructor anti-pattern (Odoo-specific reiteration)

From `owl_components.html`:

> _"First of all, components are classes, so they have a constructor. But constructors are special methods in javascript that are not overridable in any way. Since this is an occasionally useful pattern in Odoo, we need to make sure that no component in Odoo directly uses the constructor method. Instead, components should use the `setup` method."_

```js
// correct
class MyComponent extends Component {
  setup() {
    // initialize component here
  }
}

// incorrect. Do not do that!
class IncorrectComponent extends Component {
  constructor(parent, props) {
    // initialize component here
  }
}
```

Reason beyond OWL's own rule: Odoo monkey-patches `setup` across addons. Overriding the constructor breaks that mechanism.

## The Odoo env

Odoo attaches these keys to `this.env` (`framework_overview.html`):

| Key | Type | Purpose |
|-----|------|---------|
| `qweb` | OWL internal | Contains all templates |
| `bus` | `EventBus` | App-wide event bus |
| `services` | object | Every deployed service (usually accessed via `useService`) |
| `debug` | string | Empty if debug mode is off; can contain `assets`, `tests`, or both |
| `_t` | function | Translation function |
| `isSmall` | boolean | `true` if viewport width ≤ 767px |

Translating runtime strings:

```js
const msg = this.env._t("some text");
```

Templates are translated automatically; no action needed.

## Services and `useService`

A service is a long-lived piece of code registered in `registry.category("services")`. Components access services via the `useService` hook:

```js
import { useService } from "@web/core/utils/hooks";

class MyComponent extends Component {
  setup() {
    this.action = useService("action");
    this.notification = useService("notification");
  }

  openSettings() {
    this.action.doAction("base_setup.action_general_configuration");
  }
}
```

Declaring a service:

```js
import { registry } from "@web/core/registry";

const myService = {
  dependencies: ["notification"],
  start(env, { notification }) {
    let counter = 1;
    setInterval(() => notification.add(`Tick Tock ${counter++}`), 5000);
  },
};
registry.category("services").add("myService", myService);
```

For shared-state services, return an object with getter/setter methods from `start()` (tutorial ch.2).

## Registries as extension points

`registry.category(name)` produces a named map. Important categories:

- `services` — services started at boot.
- `fields` — field components (form/list cells).
- `actions` — client actions.
- `main_components` — components rendered in the `MainComponentsContainer` (globally-available UI like popovers, dialogs).
- `lazy_components` — components lazily mounted via `LazyComponent` + an asset bundle.
- `formatters`, `parsers`, `views`, and many others — documented in `framework_overview.html`.

## Reactive patterns across components via services

The tutorial demonstrates the pattern for app-wide reactive state:

```js
// in a service's start()
const state = reactive({ statistics: null });

// consumer component
setup() {
  const statService = useService("statistics");
  this.state = useState(statService.state);
}
```

Writes to `statService.state` from any origin update every consumer that reads the keys.

## RPC from components

```js
import { rpc } from "@web/core/network/rpc";

setup() {
  onWillStart(async () => {
    this.result = await rpc("/my/controller", { a: 1, b: 2 });
  });
}
```

Caching: wrap with `memoize` from `@web/core/utils/functions` if the same response is fine for the full page lifetime; otherwise keep the cache in a service.

## Lazy loading — `LazyComponent`

For heavy widgets, load them on demand with `LazyComponent` (`@web/core/assets`) plus `lazy_components` registry:

```js
import { LazyComponent } from "@web/core/assets";

export class LoaderAction extends Component {
  static components = { LazyComponent };
  static template = xml`
    <LazyComponent bundle="'your_module.assets_heavy'" Component="'HeavyWidget'"/>`;
}

registry.category("actions").add("your_module.loader_action", LoaderAction);
```

## Standalone OWL apps (outside the web client)

To run OWL without the full web client, use `mountComponent` from `@web/env`:

```js
// root.js
import { Component } from "@odoo/owl";

export class Root extends Component {
  static template = "your_module.Root";
  static props = {};
}
```

```js
// app.js
import { whenReady } from "@odoo/owl";
import { mountComponent } from "@web/env";
import { Root } from "./root";

whenReady(() => mountComponent(Root, document.body));
```

`mountComponent` creates the OWL app with translations, services, and the env already configured (`howtos/standalone_owl_application.html`).

## Dev mode in Odoo

Odoo passes the debug flag to OWL via `env.debug`. Running `?debug=1` in the URL puts Odoo in debug mode. In debug mode, OWL's `dev: true` checks are enabled for the web-client application, so props validation and loop-key unicity checks fire while you're iterating. Log messages reference the 3-second `willStart`/`willUpdateProps` warning mentioned in `app.md`.

## The `browser` indirection

Odoo wraps DOM / timer APIs in a `browser` module so tests can mock them:

```js
import { browser } from "@web/core/browser/browser";

browser.setTimeout(someFunction, 1000);
```

For OWL code you write in an Odoo module, prefer `browser.X` over direct `window.X`/`document.X` access where possible — it keeps unit tests deterministic.

## Notable Odoo-provided OWL components

Reusable components maintained by the web team (from `owl_components.html`):

- `ActionSwiper` — swipe actions on touch devices.
- `CheckBox` — labeled checkbox.
- `ColorList` — chooser over Odoo's fixed colour palette.
- `Dropdown` / `DropdownItem` / `DropdownGroup` — full-featured menu system.
- `Notebook` — tabs.
- `Pager` — pagination controls.
- `SelectMenu` — richer dropdown (prefer native `<select>` when you can).
- `TagsList` — coloured tag pills.

Each has a documented props API in `owl_components.html`. Use them instead of hand-rolling equivalents.

## Summary: what to remember when writing OWL in Odoo

1. Use `setup()`, never `constructor`.
2. Templates in XML files under `addon.ComponentName`; JS/XML/SCSS in one folder with matching snake-case names.
3. Pull dependencies from `@web/core/utils/hooks` (`useService`, `useBus`, `useChildRef`, etc.) on top of OWL's own hooks.
4. Use registries for extensibility; put cross-component state in services, not in parent components.
5. Debug mode is controlled by Odoo's `?debug=1` / env.debug, not by setting `dev: true` yourself.

For anything else about OWL as a library — components, reactivity, templates, performance — go to the OWL references in this skill.
