---
name: core-assets-and-modules
description: Asset bundles, manifest directives, lazy loading, named lazy bundles, `LazyComponent`, Odoo module transpilation, aliases, import rules, and common module-loading failures.
---

# Assets and Modules

Use this reference when code is not loading, the wrong bundle is involved, or a module boundary is unclear.

## Choose the module type on purpose

Odoo supports three JavaScript file styles:

- Plain JS: only for external libraries or rare low-level cases.
- Native modules: the default for new code.
- Legacy Odoo modules: old `odoo.define(...)` files.

Rule of thumb: new code should be native modules with the Odoo annotation when needed.

```js
/** @odoo-module **/

import { registry } from "@web/core/registry";

export function registerThing() {
  registry.category("main_components");
}
```

## Know how Odoo names modules

- `web/static/src/file_a.js` becomes `@web/file_a`.
- `some_addon/static/src/path/to/file.js` becomes `@some_addon/path/to/file`.
- Relative imports only work inside the same addon.
- Cross-addon imports should use the full Odoo module name.

```js
import { something } from "@web/core/utils/functions";
import { localThing } from "./local_thing";
```

## Use aliases only as migration glue

If legacy code still requires an old module name, add one alias on the module header:

```js
/** @odoo-module alias=web.someName **/

export default function doWork() {}
```

This is for transition work, not as a default pattern for new modules.

## Respect the transpiler limits

Odoo does not use a full JS parser for module conversion. The practical consequences:

- `import` and `export` need to start on a clean line.
- Do not hide `import` or `export` inside multiline strings or comments.
- Avoid inline comments inside exported object literals.

If a module behaves strangely, check these syntax limits before assuming the bundle is broken.

## Bundles are the real loading unit

The important built-in bundles:

- `web.assets_common`: low-level framework pieces shared by backend, website, and POS.
- `web.assets_backend`: backend web-client code.
- `web.assets_frontend`: website/public frontend code.
- `web.assets_unit_tests`: JavaScript unit tests, helpers, and mocks.

Typical manifest shape:

```python
'assets': {
    'web.assets_backend': [
        'my_addon/static/src/**/*',
    ],
    'web.assets_unit_tests': [
        'my_addon/static/tests/**/*',
    ],
}
```

## Use manifest operations instead of bundle hacks

Available bundle directives:

- append: `'path/to/file.js'`
- prepend: `('prepend', 'path/to/file.js')`
- before: `('before', 'target', 'path/to/file.js')`
- after: `('after', 'target', 'path/to/file.js')`
- include: `('include', 'web._some_sub_bundle')`
- remove: `('remove', 'target')`
- replace: `('replace', 'target', 'path/to/file.js')`

Two rules matter most:

- `before`, `after`, `replace`, and `remove` only work if the target is already declared.
- If addon `b` changes assets from addon `a`, addon `b` must depend on addon `a`.

## Control bundle order explicitly

Odoo keeps only the first occurrence of a file path in a bundle. Use that to force one file ahead of a glob:

```python
'web.assets_common': [
    'my_addon/static/lib/jquery/jquery.js',
    'my_addon/static/lib/jquery/**/*',
]
```

That pattern is simpler than inventing an `ir.asset` record for every ordering issue.

## Lazy loading is the supported escape hatch

For rarely needed libraries, load on demand instead of bloating the default bundle:

```js
import { loadAssets } from "@web/core/assets";

await loadAssets({
  jsLibs: ["/web/static/lib/stacktracejs/stacktrace.js"],
  cssLibs: ["/my_addon/static/src/my_dialog.css"],
});
```

Inside components, the matching hook is `useAssets(...)`.

## Named lazy bundles pair with `LazyComponent`

The solution-backed dashboard pattern is:

1. keep a tiny loader in `web.assets_backend`;
2. move the heavy implementation into a named bundle;
3. register the real implementation in `registry.category("lazy_components")`.

Manifest shape:

```python
'assets': {
    'web.assets_backend': [
        'awesome_dashboard/static/src/**/*',
        ('remove', 'awesome_dashboard/static/src/dashboard/**/*'),
    ],
    'awesome_dashboard.dashboard': [
        'awesome_dashboard/static/src/dashboard/**/*',
    ],
}
```

Loader component:

```js
import { registry } from "@web/core/registry";
import { LazyComponent } from "@web/core/assets";
import { Component, xml } from "@odoo/owl";

class AwesomeDashboardLoader extends Component {
    static components = { LazyComponent };
    static template = xml`
        <LazyComponent bundle="'awesome_dashboard.dashboard'"
                       Component="'AwesomeDashboard'"
                       props="props"/>
    `;
}

registry.category("actions").add("awesome_dashboard.dashboard", AwesomeDashboardLoader);
```

Actual implementation:

```js
registry.category("lazy_components").add("AwesomeDashboard", AwesomeDashboard);
```

The non-obvious part is the manifest `remove`: it keeps the heavy implementation out of the default backend bundle so the lazy bundle is not loaded twice.

## `loadJS(...)` is the low-level fit for browser globals

If a component needs a legacy browser global such as `Chart`, load it in `onWillStart` and tear down the instance in lifecycle hooks:

```js
import { loadJS } from "@web/core/assets";
import { onMounted, onPatched, onWillStart, onWillUnmount } from "@odoo/owl";

setup() {
    onWillStart(() => loadJS("/web/static/lib/Chart/Chart.js"));
    onMounted(() => this.renderChart());
    onPatched(() => {
        this.chart.destroy();
        this.renderChart();
    });
    onWillUnmount(() => this.chart.destroy());
}
```

Use this only for libraries that genuinely expose browser globals or do not fit normal module imports.

## `ir.asset` exists, but use it selectively

Dynamic `ir.asset` records are valid and have the same expressive power as manifest directives, but the docs explicitly position them as mostly useful for website-style conditional assets. For normal backend addon work, keep asset declarations in `__manifest__.py`.

## Fast debugging checklist when a file is not updating

1. Confirm the file is in the right bundle.
2. Refresh the page manually; Odoo has no hot reload.
3. Use `debug=assets`.
4. Regenerate assets from the debug menu or restart the server.
5. During active development, `--dev=xml` forces bundle freshness checks.
