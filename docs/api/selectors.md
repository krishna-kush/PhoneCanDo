# Selectors

```json
{
  "id": "com.zepto:id/search",
  "text": "Search",
  "textContains": "Search",
  "desc": "Search",
  "cls": "android.widget.EditText",
  "index": 0,
  "parent": {"text": "Search"},
  "near": {"x": 540, "y": 260, "radius": 200},
  "clickable": true,
  "editable": true,
  "scrollable": false,
  "visible": true
}
```

Resolution order: exact `id` > exact `text` > `desc` > `textContains` >
structural (`parent`/`near`/`index`). Score candidates; if the best two are
close, return `AMBIGUOUS` with candidates instead of tapping the wrong one.
`i` is the deterministic escape hatch: the AI observed a snapshot and can
point at the exact node.

## Rules

- Multiple matches are explicit `AMBIGUOUS`; `index` is the disambiguator.
  There is no silent first match.
- A selector may be referenced by name inside a pack (`selectors` map); see
  `packs.md`.
- Snapshot-node targets (`i`) are not valid inside a pack; packs live longer
  than one snapshot.
- The PCE selector contract is in `pce/docs/api/selectors.md`.
