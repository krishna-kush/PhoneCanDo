# Snapshots and node ids

`RawSnapshot` is backend-owned and uses `BackendNodeId`. `Snapshot` is
core-owned:

- `snapshot.nodes[i].id == NodeId(i)`; ids are dense and ordered.
- `Node.parentId` and `Node.childIds` form the tree.
- `Snapshot.focusedNodeId` is the focused node, if any.
- `Snapshot.packageName` and `Snapshot.activityName` describe the foreground app;
  `activityName` is optional and backend-provided.
- `Snapshot.screenshot` is an optional `ScreenshotRef` when
  `ObserveOptions.screenshot` is true.
- `snapshot.node(id)` is the safe lookup.
- A snapshot id is stable for one PCE instance and is never reused.

Always act against the snapshot that produced the node. A changed screen makes
the old snapshot stale; the PCE returns `STALE_SNAPSHOT` instead of acting on
a different screen. Re-observe after navigation or a screen change.
