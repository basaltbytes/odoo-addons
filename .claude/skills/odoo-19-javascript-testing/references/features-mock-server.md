# Mock Server

Use the mock server when the test needs fake ORM data, fake view arches, intercepted
routes, or controlled RPC behavior without a Python backend.

## Mental model

Each test env gets its own mock server. The server:

- stores mock models
- maps routes to callbacks
- hijacks frontend server requests
- handles common Odoo routes such as `/web/dataset/call_kw`

Most tests do not start it directly because `makeMockEnv`, `mountWithCleanup`, and
`mountView` already do.

Everything here lives in:

```js
import {
  MockServer,
  defineModels,
  fields,
  makeMockServer,
  models,
  onRpc,
} from "@web/../tests/web_test_helpers";
```

## Define models before the env starts

The normal way to supply ORM-backed test data is:

1. define a class extending `models.Model`
2. set metadata such as `_name`, `_records`, and `_views`
3. register it with `defineModels(...)`

```js
import {defineModels, fields, models} from "@web/../tests/web_test_helpers";

class ResPartner extends models.Model {
  _name = "res.partner";

  name = fields.Char({required: true});

  _records = [{name: "Mitchel Admin"}];

  _views = {
    list: /* xml */ `
      <list>
        <field name="display_name" />
      </list>
    `,
    form: /* xml */ `
      <form>
        <field name="name" />
      </form>
    `,
  };
}

defineModels({ResPartner});
```

Notes:

- public class fields are interpreted as model fields
- special keys starting with `_` act as metadata holders
- model-specific methods can live on the class as well
- `_inherit` is not a real substitute for Python-side inheritance here; prefer normal JS
  class extension

You can call `defineModels` at file scope for the whole file or inside a single test for
narrower scope.

## Fields, records, and views

### Fields

Fields can be declared either as public class fields or under `_fields`.

```js
ResPartner._fields.date = fields.Date({string: "Registration date"});
```

Good to remember:

- relational fields need a `relation`
- basic properties such as `readonly`, `required`, and `string` are supported
- `compute` and `related` only work for simple cases
- every model already has `id`, `display_name`, `created_at`, and `updated_at`

### Records

`_records` only seeds initial rows when the model is loaded. It is not a live mutable
store.

That means:

- define `_records` before the server starts
- after startup, create or update records through the UI or
  `MockServer.current.env[...]`

### Views

`_views` is a simplified mapping from view type to XML arch, optionally keyed as
`type,id`.

```js
ResPartner._views.list = /* xml */ `
  <list>
    <field name="display_name" />
  </list>
`;

ResPartner._views["form,418"] = /* xml */ `
  <form>
    <field name="name" />
    <field name="date" />
  </form>
`;
```

## `onRpc`: intercept routes and ORM calls

Use `onRpc` when defining a full model is overkill, when the request is not
model-backed, or when you want to observe or amend an existing server result.

### Route callback

```js
onRpc("/route/to/test", async (request) => {
  const {ids} = await request.json();
  expect.step(ids);
  return {};
});
```

Pass `{ pure: true }` as the third argument when you need to return a custom `Response`
directly.

### Method callback

```js
onRpc("web_read", async ({args, parent}) => {
  const result = parent();
  expect.step(args[0]);
  result.some_meta_data = {foo: "bar"};
  return result;
});
```

### Method + model callback

```js
onRpc("web_read", "res.partner", ({args}) => {
  expect.step(args[0]);
});
```

### Catch-all ORM callback

```js
onRpc(({method}) => {
  expect.step(method);
});
```

Critical sequencing rule: multiple `onRpc` handlers for the same target run from last
defined to first defined. Returning a non-null value stops the chain. Call `parent()`
when you want to keep the previous behavior and extend it.

## `makeMockServer` versus `MockServer.current`

`makeMockServer()` is the low-level escape hatch for testing server behavior without an
env, such as testing the RPC function itself. Do not use it as the normal way to fetch
the active server.

For the active server, use `MockServer.current`:

```js
const ids = MockServer.current.env["res.partner"].create([
  {name: "foo"},
  {name: "bar"},
]);
```

This is useful to simulate out-of-band database changes. But remember:

- it only changes the fake database
- it does not trigger a UI rerender by itself

`MockServer.env` is a shortcut to `MockServer.current.env`.

## Sources

- https://www.odoo.com/documentation/19.0/developer/reference/frontend/unit_testing/mock_server.html
