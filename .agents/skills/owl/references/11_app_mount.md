# App, mount, configuration

Sources: `app.md`, `utils.md`, `environment.md`, `readme.md`.

## The two entry points

### `mount(Component, target, config?)` — convenience helper

Used when you just want a running app with a single root component:

```js
import { Component, mount, xml } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`<div>Hello</div>`;
}

mount(MyComponent, document.body);
```

Returns a promise that resolves to the component instance.

### `new App(Component, config?).mount(target, options?)` — full control

```js
import { Component, App } from "@odoo/owl";

class MyComponent extends Component { /* ... */ }

const app = new App(MyComponent, { props: { /* ... */ }, templates: "..." });
app.mount(document.body);
```

`App` also supports:

- `app.mount(target, { position: "first-child" | "last-child" })` — where to insert the root relative to children of `target`.
- `app.createRoot(Component, { props?, env? })` — add additional roots under the same App (sharing templates and env), e.g. for multi-root widgets. Returns a root whose `.mount(target)` and `.destroy()` you manage yourself.
- `app.destroy()` — tear down the entire app.

## Configuration keys (verbatim list from `app.md`)

| Key | Type / default | Notes |
|-----|----------------|-------|
| `env` | object | Shared env given to every component. Shallow-frozen by OWL. |
| `props` | object | Initial props for the root component. |
| `dev` | boolean (default `false`) | Enable props validation, loop-key checks, lifecycle error reporting, 3-second warnings on `willStart`/`willUpdateProps`. |
| `test` | boolean (default `false`) | Like `dev` but without the dev-mode console warning. |
| `translatableAttributes` | string[] | Extra attributes whose values should be translated (e.g. `data-title`). `-title` removes `title` from the default list. |
| `translateFn` | function | Receives `(str, ctx?)` and returns the translation. |
| `templates` | string \| XMLDocument | The XML string (or parsed document) containing every template used by the app. |
| `getTemplate` | `(s: string) => Element \| Function \| string \| void` | Custom resolver for templates. Falls back to the bundled `templates` when this returns `undefined`. |
| `warnIfNoStaticProps` | boolean (default `false`) | Log a warning for every component without `static props`. Great for enforcing props declarations. |
| `customDirectives` | object | Map of `t-custom-<name>` handlers, each `(el, value) => void`. See `templates.md`. |
| `globalValues` | object | Values made available to every template at compile time. |

## Dev-mode amenities (from `app.md`)

> _"Dev mode activates some additional checks and developer amenities:
> - Props validation is performed
> - `t-foreach` loops check for key unicity
> - Lifecycle hooks are wrapped to report their errors in a more developer-friendly way
> - `onWillStart` and `onWillUpdateProps` will emit a warning in the console when they take longer than 3 seconds in an effort to ease debugging the presence of deadlocks"_

Keep it on in development, off in production. The validation cost is not huge but is measurable.

## Loading templates from a file

```js
import { loadFile, mount } from "@odoo/owl";

(async function setup() {
  const templates = await loadFile("/some/endpoint/that/returns/templates");
  const env = {
    _t: someTranslateFn,
    templates,
    // possibly other stuff
  };
  mount(Root, document.body, { templates, env });
})();
```

`loadFile(url)` is a small async helper exported from `@odoo/owl` (`utils.md`).

## Multi-root applications

When an OWL app must render into several disconnected places in the DOM (e.g. embedding one or more widgets into an existing non-OWL page), use `createRoot`:

```js
const root = app.createRoot(MyComponent, { props: { someProps: true } });
await root.mount(targetElement);

// later
root.destroy();
```

From `app.md`:

> _"it is the responsibility of the code that created the root to properly destroy it (before it has been removed from the DOM!). Owl has no way of doing it itself."_

Call `root.destroy()` **before** removing the target element from the DOM, otherwise you leak listeners and reactive subscriptions.

## Environment

An env is the implicit "dependency injection" container for the app. Every component reads it via `this.env`; hooks `useEnv`, `useSubEnv`, and `useChildSubEnv` are the composition primitives (`environment.md`, `04_hooks.md`).

OWL does not use the env for anything itself — it's yours to populate with services, translators, feature flags, etc. Because the env is shallow-frozen when the app starts, structure it fully at mount time and use `useSubEnv`/`useChildSubEnv` for scoped additions.

```js
const env = {
  _t: myTranslateFunction,
  user: { /* ... */ },
  services: { /* ... */ },
};

new App(Root, { env }).mount(document.body);
// or
mount(Root, document.body, { env });
```

## `whenReady()` — wait for DOMContentLoaded

```js
import { whenReady } from "@odoo/owl";

await whenReady();   // or whenReady(cb)
// safe to touch the DOM here
```

Useful when the app script runs before the target element exists. Exported from `@odoo/owl` (`utils.md`).

## `batched(fn)`

Not strictly App-configuration, but often used at bootstrap:

```js
import { batched } from "@odoo/owl";

const persistStateSoon = batched(() => localStorage.setItem("state", JSON.stringify(store)));
reactive(store, persistStateSoon);
```

One callback fires per microtask, regardless of how many reactive writes happened.

## `EventBus`

OWL exports a plain `EventBus` (actually an `EventTarget`) from `@odoo/owl` (`utils.md`):

```js
import { EventBus } from "@odoo/owl";

const bus = new EventBus();
bus.addEventListener("event", () => console.log("something happened"));
bus.trigger("event"); // 'something happened'
```

Use it for custom app-wide events that don't belong in the DOM.

## API surface at a glance (OWL 2.8.x)

The full public exports, from `src/runtime/index.ts`, grouped by area:

- **App / mount / templates:** `App`, `mount`, `xml`
- **Component:** `Component`, `useComponent`, `useState`, `status`
- **Reactivity:** `reactive`, `markRaw`, `toRaw`
- **Hooks:** `useEffect`, `useEnv`, `useExternalListener`, `useRef`, `useChildSubEnv`, `useSubEnv`
- **Lifecycle hooks:** `onWillStart`, `onMounted`, `onWillUnmount`, `onWillUpdateProps`, `onWillPatch`, `onPatched`, `onWillRender`, `onRendered`, `onWillDestroy`, `onError`
- **Utilities:** `batched`, `EventBus`, `htmlEscape`, `whenReady`, `loadFile`, `markup`
- **Validation:** `validate`, `validateType`
- **Errors:** `OwlError`
- **Low-level VDOM:** `blockDom` (namespace object exposing `config`, `mount`, `patch`, `remove`, `list`, `multi`, `text`, `toggler`, `createBlock`, `html`, `comment`)
- **Version info:** `__info__.version === "2.8.x"`
