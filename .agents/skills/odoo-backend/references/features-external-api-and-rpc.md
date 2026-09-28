---
name: features-external-api-and-rpc
description: "The Odoo 19 external API surface: prefer JSON-2 with bearer API keys, understand per-call transactions, and maintain legacy XML-RPC or JSON-RPC `execute_kw` integrations safely."
---

# External API and RPC

For new Odoo 19 integrations, prefer JSON-2. XML-RPC and old JSON-RPC still exist for legacy clients, but the docs treat them as deprecated.

## JSON-2 Default

Endpoint shape:

```text
POST /json/2/<model>/<method>
```

Headers that matter:

- `Authorization: bearer <api_key>`
- `Content-Type: application/json`
- `X-Odoo-Database: <db_name>` when the host serves multiple databases

```json
{
  "domain": [["is_company", "=", true]],
  "fields": ["name", "country_id"],
  "limit": 10
}
```

## Rules That Matter

- Each JSON-2 call is one SQL transaction. Do not split one logical operation across calls when consistency matters.
- Prefer `search_read` over separate `search` then `read`.
- Use dedicated bot users for long-lived integrations.
- Inspect the database-local `/doc` page for live models, fields, and methods.
- Pick `fields` explicitly; avoid broad `read()` calls.

## Legacy XML-RPC / JSON-RPC

Keep classic `execute_kw(...)` clients only when you are maintaining existing integrations.

```python
uid = common.authenticate(db, username, password, {})
models.execute_kw(
    db,
    uid,
    password,
    "res.partner",
    "search_read",
    [[["is_company", "=", True]]],
    {"fields": ["name"], "limit": 5},
)
```

## Migration map

| Legacy | JSON-2-era replacement |
| --- | --- |
| `version()` | `GET /web/version` |
| `login()` / `authenticate()` | Bearer API key auth |
| object-service `execute_kw(...)` | `POST /json/2/<model>/<method>` |
| custom `@route(type="jsonrpc")` | Keep only when a controller is truly needed |
