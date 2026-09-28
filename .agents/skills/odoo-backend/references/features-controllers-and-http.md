---
name: features-controllers-and-http
description: Odoo web controllers, route inheritance rules, and the request environment for backend endpoints that should not be modeled as plain ORM methods.
---

# Controllers and HTTP

Use controllers when transport is HTTP-first: webhooks, downloads, public endpoints, or flows that do not fit model-level RPC.

## Minimal controller shape

```python
from odoo import http
from odoo.http import request


class BusinessTripController(http.Controller):
    @http.route("/business_trip/<int:trip_id>/summary", auth="user", type="http")
    def trip_summary(self, trip_id):
        trip = request.env["business.trip"].browse(trip_id)
        return request.make_json_response({
            "id": trip.id,
            "name": trip.name,
            "state": trip.state,
        })
```

## Route inheritance rule that still causes regressions

When overriding a controller method, re-decorate it with `@route()` or the route is unpublished.

```python
class ExtendedBusinessTripController(BusinessTripController):
    @http.route()
    def trip_summary(self, trip_id):
        response = super().trip_summary(trip_id)
        return response
```

- No arguments keep previous route metadata.
- Provided arguments override previous metadata.

## Use controllers sparingly

If the operation is standard record business logic, keep it on the model and call through ORM or JSON-2. Controllers are for routing, auth, transport, or file concerns.

## Use the request environment, not globals

Use `request.env`, not globals, so multi-db, auth, and request transaction handling stay consistent.
