# Selectors

`Selector` is an AND of its non-null fields:

| Field | Meaning |
|---|---|
| `viewId` | Exact view id. |
| `text` | Exact text. |
| `textContains` | Case-insensitive substring. |
| `contentDescription` | Exact content description. |
| `className` | Exact class name. |
| `packageName` | Exact package name. |
| `parent` | Nested selector; the match's parent must match. |
| `near` | `Near(point, radius)` proximity filter. |
| `requiredFlags` / `forbiddenFlags` | `NodeFlag` filters. |
| `index` | Explicit disambiguator after all other constraints. |

Multiple matches are `AMBIGUOUS` with candidate ids. The resolver never picks
the first match silently. Use a tighter selector or `index` when the ambiguity
is intentional.
