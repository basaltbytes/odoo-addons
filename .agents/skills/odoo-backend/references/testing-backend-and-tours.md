---
name: testing-backend-and-tours
description: Python backend tests, Odoo test helpers, tags, `Form`, `HttpCase`, tours, and query-count assertions for catching regressions before they ship.
---

# Backend Testing and Tours

Use this for Odoo-specific backend testing: class choice, `Form`, tags, tours, and query budgets.

## Base class choice

| Base/helper | Use |
| --- | --- |
| `TransactionCase` | Default for model/business logic |
| `SingleTransactionCase` | One transaction shared across class tests |
| `HttpCase` | Browser or HTTP flows |
| `ref`, `browse_ref` | XML ID lookup |
| `Form`, `M2MProxy`, `O2MProxy` | Form/onchange/relational widget-like tests |

## Minimal `TransactionCase`

```python
from odoo.tests import TransactionCase


class TestBusinessTrip(TransactionCase):
    def test_confirm_trip(self):
        trip = self.env["business.trip"].create({"name": "Conference"})
        trip.action_confirm()
        self.assertEqual(trip.state, "confirmed")
```

## Tagging and test selection

Common pattern for browser-heavy cases:

```python
from odoo.tests import HttpCase, tagged


@tagged("-at_install", "post_install")
class TestTripUi(HttpCase):
    ...
```

CLI selection:

```bash
odoo-bin --test-tags /my_module
odoo-bin --test-tags "standard,-slow"
odoo-bin --test-tags "/my_module:TestBusinessTrip.test_confirm_trip"
```

## Use `Form` for form-style flows

When business logic depends on defaults, onchanges, or relational widget-like semantics, `Form` is usually better than calling `create()` with a giant dict.

## Tours are for end-to-end cooperation between Python and JS

```python
from odoo.tests import HttpCase, tagged


@tagged("-at_install", "post_install")
class TestTripTour(HttpCase):
    def test_trip_tour(self):
        self.start_tour("/web", "my_trip_tour", login="admin")
```

Tour JS must be added to assets and registered in the tour registry.

## Query-count assertions

For backend performance regressions, assert query budgets directly:

```python
with self.assertQueryCount(11):
    self.env["business.trip"]._compute_dashboard_data()
```

## Use the dedicated JS testing skill for frontend mechanics

This reference keeps only the backend/integration angle. For Hoot, web helpers, mock server, `watch=True`, `debug=True`, `break: true`, or `pause: true`, load `odoo-javascript-testing`.
