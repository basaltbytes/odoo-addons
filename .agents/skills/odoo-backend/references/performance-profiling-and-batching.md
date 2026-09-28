---
name: performance-profiling-and-batching
description: Odoo profiler usage, query-count checks, batching patterns, prefetch-friendly code, and when indexes are worth the write cost.
---

# Performance, Profiling, and Batching

Most Odoo backend wins come from fewer queries, coherent recordsets, and measurements from Odoo's own profiler.

## Start with the profiler

Use SQL plus periodic traces first. Use sync traces only when exact control flow matters more than profiler overhead.

```python
with self.profile():
    with self.assertQueryCount(__system__=1211):
        self.env["business.trip"]._build_dashboard()
```

## Batch operations by default

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

Use one batch `create(values_list)` instead of looping single creates. Browse all ids at once and iterate the recordset so prefetch works.

## Add indexes surgically

```python
name = fields.Char(index=True)
```

Indexes help searches but cost write performance. Add them where actual lookup patterns justify them.

## Profiling pitfalls

- cache warmness changes results
- profiler overhead can distort very chatty SQL workloads
- long traces can blow memory limits
- blocking C calls can look strange in periodic traces

Treat profiler output as evidence, not absolute truth.
