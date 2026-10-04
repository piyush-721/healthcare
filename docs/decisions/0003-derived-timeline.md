# ADR-0003: Derived timeline (no timeline table)

**Status:** Accepted

## Context
The timeline merges appointments, medications, records, documents, labs, plans, tasks,
vaccinations and conditions.

## Decision
Events are projected at read time from the source tables. Each source declares the permission it
needs, its date field and its search fields. Results are merged, sorted and paginated with an
`(occurred_at, key)` cursor.

## Consequences
- No duplicated data, no sync jobs, and edits or deletions show up instantly.
- Per-source permission filtering is natural.
- Each page runs up to 10 small indexed queries. If that ever becomes a bottleneck, a materialized
  event table could be added behind the same service interface.
