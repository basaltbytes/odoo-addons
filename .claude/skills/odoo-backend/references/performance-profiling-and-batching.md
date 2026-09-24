---
name: performance-profiling-and-batching
description:
  Odoo profiler usage, query-count checks, batching patterns, prefetch-friendly code,
  and when indexes are worth the write cost.
---

# Performance, Profiling, and Batching

Ignore generic Python optimization advice. Most Odoo backend wins come from fewer
queries, coherent recordsets, and measurements taken with Odoo's own profiler.

## Start with the profiler

The backend docs expose the built-in profiler, including `self.profile()` in tests.

```python
with self.profile():
    with self.assertQueryCount(__system__=1211):
        self.env["business.trip"]._build_dashboard()
```

Start with SQL plus periodic traces. Use sync traces only when exact control flow
matters more than profiler overhead.

## Batch operations by default

Classic anti-pattern:

```python
def _compute_expense_count(self):
    for trip in self:
        trip.expense_count = self.env["business.expense"].search_count(
            [("trip_id", "=", trip.id)]
        )
```

Better:

```python
def _compute_expense_count(self):
    counts = self.env["business.expense"]._read_group(
        [("trip_id", "in", self.ids)],
        ["trip_id"],
        ["__count"],
    )
    count_by_trip = dict(counts)
    for trip in self:
        trip.expense_count = count_by_trip.get(trip, 0)
```

## Batch `create()`

```python
self.env["business.trip"].create(values_list)
```

Prefer one batch create over looping one `create()` per row.

## Keep prefetch working

Bad:

```python
for trip_id in trip_ids:
    trip = self.browse(trip_id)
    trip.name
```

Better:

```python
trips = self.browse(trip_ids)
for trip in trips:
    trip.name
```

## Add indexes surgically

```python
name = fields.Char(index=True)
```

Indexes help searches but cost write performance. Add them where actual lookup patterns
justify them.

## Profiling pitfalls

- cache warmness changes results
- profiler overhead can distort very chatty SQL workloads
- long traces can blow memory limits
- blocking C calls can look strange in periodic traces

Treat profiler output as evidence, not absolute truth.
