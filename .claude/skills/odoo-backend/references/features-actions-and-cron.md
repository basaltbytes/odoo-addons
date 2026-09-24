---
name: features-actions-and-cron
description:
  Returned action dictionaries, server actions, and the correct way to design scheduled
  jobs with batching and `_commit_progress`.
---

# Actions and Cron

Backend Odoo code often bridges into the client with action dicts, or into background
execution with `ir.cron`. Keep those surfaces small, explicit, and batch-friendly.

## Action return values from Python

In practice, most backend button flows should return a dict. `False` is the usual "close
dialog" case.

```python
return {
    "type": "ir.actions.act_window",
    "name": "Trips",
    "res_model": "business.trip",
    "views": [[False, "list"], [False, "form"]],
    "domain": [("user_id", "=", self.env.uid)],
    "context": {"search_default_my_trips": 1},
}
```

## Server actions are for declarative/admin flows

Use `ir.actions.server` for admin-driven automation, not as a replacement for normal
module code.

```xml
<record id="trip_server_action" model="ir.actions.server">
    <field name="name">Open Current Trip</field>
    <field name="model_id" ref="model_business_trip"/>
    <field name="state">code</field>
    <field name="code">
if record:
    action = {
        "type": "ir.actions.act_window",
        "res_model": record._name,
        "view_mode": "form",
        "res_id": record.id,
    }
    </field>
</record>
```

Treat that evaluation context as privileged server-side execution.

## Report and client actions

- `ir.actions.report`: bind a QWeb report to a model and print menu
- `ir.actions.client`: hand off to a client-side tag

## Scheduled actions (`ir.cron`)

Cron jobs should process a batch, commit progress, and return.

```python
def _cron_process_ready_trips(self, *, limit=300):
    domain = [("state", "=", "ready")]
    records = self.search(domain, limit=limit)
    records._process_ready_batch()
    remaining = 0 if len(records) < limit else self.search_count(domain)
    self.env["ir.cron"]._commit_progress(len(records), remaining=remaining)
```

- each call should stay short
- the framework commits after each batch
- the framework re-calls as needed
- do not reschedule the same cron manually

## If you must manage the loop yourself

Keep the pattern, not the exact code:

1. lock
2. re-check the domain
3. do bounded work
4. call `_commit_progress(...)`
5. stop when the scheduler asks you to

## Do not call cron methods directly

Use the scheduler or the documented trigger methods when you need to execute them on
purpose.
