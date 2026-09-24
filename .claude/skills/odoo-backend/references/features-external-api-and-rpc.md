---
name: features-external-api-and-rpc
description:
  "The Odoo 19 external API surface: prefer JSON-2 with bearer API keys, understand
  per-call transactions, and maintain legacy XML-RPC or JSON-RPC `execute_kw`
  integrations safely."
---

# External API and RPC

For new Odoo 19 integrations, prefer JSON-2. XML-RPC and old JSON-RPC still exist for
legacy clients, but the docs treat them as deprecated.

## JSON-2 is the default for new integrations

Endpoint shape:

```text
POST /json/2/<model>/<method>
```

Headers that matter:

- `Authorization: bearer <api_key>`
- `Content-Type: application/json`
- `X-Odoo-Database: <db_name>` when the host serves multiple databases

```python
import requests

response = requests.post(
    "https://mycompany.example.com/json/2/res.partner/search_read",
    headers={
        "Authorization": f"bearer {API_KEY}",
        "X-Odoo-Database": "mycompany",
        "Content-Type": "application/json",
    },
    json={
        "domain": [["is_company", "=", True]],
        "fields": ["name", "country_id"],
        "limit": 10,
    },
)
response.raise_for_status()
partners = response.json()
```

## JSON-2 transaction rule

Each JSON-2 call runs in its own SQL transaction. Do not split one logical business
operation across multiple calls if consistency matters.

This is why `search_read` is safer than a separate `search` followed by `read` in
concurrent systems.

## Use dedicated bot users for long-lived integrations

The external API docs recommend dedicated bot users for automated integrations so
permissions stay explicit and audit trails remain useful.

## `/doc` is the live API surface

The database-local `/doc` page is the fastest way to inspect models, fields, and methods
for the current database.

## Legacy XML-RPC / JSON-RPC

Keep classic `execute_kw(...)` clients only when you are maintaining existing
integrations.

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

- `version()` -> `GET /web/version`
- `login()` / `authenticate()` -> bearer API key auth
- object-service `execute_kw(...)` -> `POST /json/2/<model>/<method>`
- keep custom `@route(type="jsonrpc")` endpoints only when you truly need custom
  controllers

## Pick fields explicitly

Whether you use JSON-2 or legacy RPC, avoid broad `read()` calls without `fields=`.
