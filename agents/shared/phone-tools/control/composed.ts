import type { Args } from "../tool"
import { act, legacy, observe, sleep } from "./pce"
import {
  clickableParent,
  editableTarget,
  firstScrollable,
  flatScreen,
  nodeMap,
  observationKey,
  scrollableAncestor,
  textNode,
  visible,
} from "./snapshot"

// The compatibility tools (mobile_launch/screen/info/click/tap/text/scroll/
// swipe/back/home/wait), each built from observe + act on the typed PCE API.
// Each one's result is JSON, or the bridge's error text.
type Run = (args: Args, signal?: AbortSignal) => Promise<string>

export const launch: Run = (args, signal) =>
  legacy(async () => {
    const packageName = String(args.packageName ?? "").trim()
    if (!packageName) throw new Error("error bad_request: packageName is required")
    const activityName = typeof args.activityName === "string" && args.activityName.trim()
      ? args.activityName.trim()
      : undefined
    const snapshot = await observe({ maxNodes: 1 }, signal)
    await act(
      snapshot.snapshotId,
      { type: "launch", packageName, ...(activityName ? { activityName } : {}) },
      signal,
    )
    return { packageName, activityName: activityName ?? "" }
  })

export const screen: Run = (args, signal) =>
  legacy(async () =>
    flatScreen(await observe({ maxNodes: 2000 }, signal), args.scrollable === true, args.editable === true),
  )

export const info: Run = (_args, signal) =>
  legacy(async () => {
    const snapshot = await observe({ maxNodes: 500 }, signal)
    const root = (snapshot.nodes ?? []).find((n: any) => n.parent == null)
    const windowChildCount = root
      ? (snapshot.nodes ?? []).filter((n: any) => n.parent === root.i).length
      : 0
    return {
      package: snapshot.package ?? "",
      activity: snapshot.activity ?? "",
      windowPackage: snapshot.package ?? "",
      windowChildCount,
    }
  })

export const click: Run = (args, signal) =>
  legacy(async () => {
    const snapshot = await observe({ maxNodes: 2000 }, signal)
    const map = nodeMap(snapshot)
    const nodes = snapshot.nodes ?? []
    let target: any = null
    if (args.text) {
      const needle = String(args.text).toLowerCase()
      const clickable = nodes.find(
        (n: any) =>
          visible(n, snapshot) &&
          n.clickable === true &&
          typeof n.text === "string" &&
          n.text.toLowerCase().includes(needle),
      )
      const first = nodes.find(
        (n: any) =>
          visible(n, snapshot) && typeof n.text === "string" && n.text.toLowerCase().includes(needle),
      )
      target = clickable ?? (first ? clickableParent(map, first, snapshot) ?? first : null)
    }
    if (!target && args.id) {
      target = nodes.find((n: any) => visible(n, snapshot) && n.id === String(args.id)) ?? null
    }
    if (!target && args.desc) {
      target =
        nodes.find(
          (n: any) =>
            visible(n, snapshot) &&
            typeof n.desc === "string" &&
            n.desc.includes(String(args.desc)),
        ) ?? null
    }
    if (!target) throw new Error("error NOT_FOUND: Element not found")
    if (target.clickable !== true) target = clickableParent(map, target, snapshot) ?? target
    await act(
      snapshot.snapshotId,
      { type: "tap", target: { type: "node", nodeId: target.i } },
      signal,
    )
    return { text: target.text ?? "" }
  })

export const tap: Run = (args, signal) =>
  legacy(async () => {
    const x = Math.round(Number(args.x))
    const y = Math.round(Number(args.y))
    const snapshot = await observe({ maxNodes: 1 }, signal)
    await act(
      snapshot.snapshotId,
      { type: "tap", target: { type: "coordinates", point: { x, y } } },
      signal,
    )
    return { x, y }
  })

export const text: Run = (args, signal) =>
  legacy(async () => {
    const value = String(args.text)
    const append = args.append === true
    for (let attempt = 0; ; attempt++) {
      const snapshot = await observe({ maxNodes: 2000 }, signal)
      const target = editableTarget(snapshot)
      if (!target) throw new Error("error NO_EDITABLE: No editable field found")
      const previousText = typeof target.text === "string" ? target.text : ""
      try {
        await act(
          snapshot.snapshotId,
          {
            type: "type_text",
            text: value,
            target: { type: "node", nodeId: target.i },
            clear: !append,
          },
          signal,
        )
        return {
          text: append ? previousText + value : value,
          previousText,
          action: append ? "append" : "set",
        }
      } catch (e) {
        // A tap can return before the field owns input focus.
        if (attempt > 0 || !/UNSUPPORTED_ACTION|NOT_EDITABLE/.test(String(e))) throw e
        await sleep(300)
      }
    }
  })

export const scroll: Run = (args, signal) =>
  legacy(async () => {
    const snapshot = await observe({ maxNodes: 2000 }, signal)
    const map = nodeMap(snapshot)
    let target: any = null
    if (args.target) {
      const match = textNode(snapshot, String(args.target))
      if (!match) throw new Error("error NOT_FOUND: No scrollable element found")
      target = scrollableAncestor(map, match) ?? firstScrollable(snapshot)
    } else {
      target = firstScrollable(snapshot)
    }
    if (!target) throw new Error("error NOT_FOUND: No scrollable element found")
    const direction = args.direction === "up" ? "UP" : "DOWN"
    const count = Math.max(1, Math.round(Number(args.count) || 1))
    for (let i = 0; i < count; i++) {
      await act(
        snapshot.snapshotId,
        { type: "scroll", direction, target: { type: "node", nodeId: target.i } },
        signal,
      )
    }
    return { direction: args.direction ?? "down", count }
  })

export const swipe: Run = (args, signal) =>
  legacy(async () => {
    const x1 = Math.round(Number(args.x1))
    const y1 = Math.round(Number(args.y1))
    const x2 = Math.round(Number(args.x2))
    const y2 = Math.round(Number(args.y2))
    const duration = Math.max(1, Math.round(Number(args.duration) || 300))
    const snapshot = await observe({ maxNodes: 1 }, signal)
    await act(
      snapshot.snapshotId,
      { type: "swipe", from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, durationMs: duration },
      signal,
    )
    return { x1, y1, x2, y2, duration }
  })

function key(name: "BACK" | "HOME"): Run {
  return (_args, signal) =>
    legacy(async () => {
      const snapshot = await observe({ maxNodes: 1 }, signal)
      await act(snapshot.snapshotId, { type: "key", key: name }, signal)
      return {}
    })
}

export const back = key("BACK")
export const home = key("HOME")

export const wait: Run = (args, signal) =>
  legacy(async () => {
    const timeoutMs = Math.min(12_000, Math.max(100, Math.round(Number(args.timeoutMs) || 5000)))
    const started = Date.now()
    let current = await observe({ maxNodes: 500 }, signal, timeoutMs + 5000)
    const baseline = observationKey(current)
    while (Date.now() - started < timeoutMs) {
      await sleep(Math.min(250, timeoutMs))
      if (signal?.aborted) throw new Error(`bridge timeout (${Math.round((timeoutMs + 5000) / 1000)}s)`)
      current = await observe({ maxNodes: 500 }, signal, timeoutMs + 5000)
      if (observationKey(current) !== baseline) {
        return {
          changed: true,
          timeoutMs,
          package: current.package ?? "",
          activity: current.activity ?? "",
        }
      }
    }
    return {
      changed: false,
      timeoutMs,
      package: current.package ?? "",
      activity: current.activity ?? "",
    }
  })
