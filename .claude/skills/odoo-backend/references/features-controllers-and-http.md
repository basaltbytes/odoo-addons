---
name: features-controllers-and-http
description:
  Odoo web controllers, route inheritance rules, and the request environment for backend
  endpoints that should not be modeled as plain ORM methods.
---

# Controllers and HTTP

Use controllers when the transport is HTTP-first: webhooks, downloads, custom public
endpoints, or flows that must exist before model-level RPC is the right abstraction.

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

When overriding a controller method, re-decorate it with `@route()` or the route gets
unpublished.

```python
class ExtendedBusinessTripController(BusinessTripController):
    @http.route()
    def trip_summary(self, trip_id):
        response = super().trip_summary(trip_id)
        return response
```

- no arguments: keep previous route metadata
- provided arguments: override previous metadata

## Use controllers sparingly

If the operation is standard business logic on records, keep it on the model and call it
through the ORM or JSON-2. Controllers are for routing, auth, transport, or file
concerns.

## Use the request environment, not globals

Controller code should operate through `request.env`, just as model code uses
`self.env`. That keeps multi-db, auth, and request transaction handling consistent.
