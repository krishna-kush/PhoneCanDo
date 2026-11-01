import { Plugin } from "@opencode/plugin"

// The engine runs as a separate process from the app, so the agent reaches
// Android through the loopback bridge in PhoneCanDoServeService. URL + token come
// from the serve env (never hardcoded, never on disk).
const BASE = process.env.PHONECANDO_BRIDGE_URL
const TOKEN = process.env.PHONECANDO_BRIDGE_TOKEN
// Injected by PhoneCanDoServeService from the build flavor. Play builds do not
// register the UI tools at all (no driver, no service).
const PHONE_CONTROL = process.env.PHONECANDO_AUTOMATION !== "play"

async function call(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<string> {
  if (!BASE || !TOKEN) {
    return "phonecando bridge unavailable: engine not started by PhoneCanDo (missing PHONECANDO_BRIDGE_URL/TOKEN)"
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const relay = () => ctrl.abort()
  signal?.addEventListener("abort", relay)
  try {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    const text = await res.text()
    let parsed: { ok?: boolean; data?: unknown; code?: string; message?: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      return `bridge ${res.status}: ${text.slice(0, 300)}`
    }
    if (parsed.ok === true) return JSON.stringify(parsed.data ?? {})
    return `error ${parsed.code ?? res.status}: ${parsed.message ?? "unknown"}`
  } catch (e) {
    if (ctrl.signal.aborted) return `bridge timeout (${Math.round(timeoutMs / 1000)}s)`
    return `bridge call failed: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", relay)
  }
}

type Args = Record<string, any>

// The compatibility tools below are thin wrappers over the typed PCE API.
// Keep their names stable: prompts and saved chats already use them.
async function pce(path: string, body: unknown, signal?: AbortSignal, timeoutMs = 15_000): Promise<any> {
  const text = await call(path, body, signal, timeoutMs)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text)
  }
}

function observe(args: Args = {}, signal?: AbortSignal, timeoutMs = 15_000): Promise<any> {
  return pce("/pce/observe", { windows: false, maxNodes: 500, ...args }, signal, timeoutMs)
}

function act(snapshotId: number, action: unknown, signal?: AbortSignal): Promise<any> {
  return pce("/pce/act", { snapshotId, action, timeoutMs: 30_000 }, signal, 35_000)
}

async function legacy(run: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await run())
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function boundsOf(node: any): [number, number, number, number] | null {
  const b = node?.bounds
  return Array.isArray(b) && b.length === 4 && b.every((v: any) => typeof v === "number") ? b : null
}

function centerOf(node: any): { x: number; y: number } | null {
  const b = boundsOf(node)
  return b ? { x: Math.floor((b[0] + b[2]) / 2), y: Math.floor((b[1] + b[3]) / 2) } : null
}

function visible(node: any, snapshot: any): boolean {
  const b = boundsOf(node)
  const c = centerOf(node)
  if (!b || !c || b[2] <= b[0] || b[3] <= b[1] || node?.visible === false) return false
  const display = snapshot?.device?.display
  return !Array.isArray(display) || (c.x >= 0 && c.x < display[0] && c.y >= 0 && c.y < display[1])
}

function nodeMap(snapshot: any): Map<number, any> {
  return new Map((snapshot?.nodes ?? []).map((n: any) => [n.i, n]))
}

function clickableParent(map: Map<number, any>, node: any, snapshot: any): any | null {
  let current = map.get(node?.parent)
  for (let depth = 0; current && depth < 5; depth++) {
    if (current.clickable === true && visible(current, snapshot)) return current
    current = map.get(current.parent)
  }
  return null
}

function scrollableAncestor(map: Map<number, any>, node: any): any | null {
  let current = node
  for (let depth = 0; current && depth < 10; depth++) {
    if (current.scrollable === true) return current
    current = map.get(current.parent)
  }
  return null
}

function firstScrollable(snapshot: any): any | null {
  return (snapshot?.nodes ?? []).find((n: any) => n.scrollable === true && visible(n, snapshot)) ?? null
}

function textNode(snapshot: any, text: string): any | null {
  const needle = text.toLowerCase()
  return (snapshot?.nodes ?? []).find(
    (n: any) => visible(n, snapshot) && typeof n.text === "string" && n.text.toLowerCase().includes(needle),
  ) ?? null
}

function editableTarget(snapshot: any): any | null {
  const nodes = snapshot?.nodes ?? []
  const focused = nodes.find((n: any) => n.i === snapshot.focused)
  if (focused && focused.editable === true && visible(focused, snapshot)) return focused
  return nodes.find((n: any) => n.editable === true && visible(n, snapshot)) ?? null
}

function signature(snapshot: any): string {
  return JSON.stringify({
    package: snapshot?.package ?? "",
    activity: snapshot?.activity ?? "",
    focused: snapshot?.focused ?? null,
    nodes: (snapshot?.nodes ?? []).map((n: any) => [
      n.text ?? "",
      n.desc ?? "",
      n.bounds ?? [],
      n.clickable === true,
      n.editable === true,
      n.scrollable === true,
      n.focused === true,
      n.checked === true,
      n.selected === true,
    ]),
  })
}

// Include the accessibility event sequence when present: it notices a screen
// that changed and reverted between two polls. The signature still covers a
// change that emitted no event.
function observationKey(snapshot: any): string {
  const sig = signature(snapshot)
  return typeof snapshot?.eventSeq === "number"
    ? `seq:${snapshot.eventSeq}|${sig}`
    : sig
}

function flatScreen(snapshot: any, onlyScrollable: boolean, onlyEditable: boolean): any {
  const map = nodeMap(snapshot)
  const elements: any[] = []
  for (const node of snapshot?.nodes ?? []) {
    if (!visible(node, snapshot)) continue
    const text = typeof node.text === "string" ? node.text : ""
    const desc = typeof node.desc === "string" ? node.desc : ""
    if (!text && !desc) continue
    if (onlyEditable && node.editable !== true) continue
    if (onlyScrollable && !scrollableAncestor(map, node)) continue
    const bounds = boundsOf(node)!
    const center = centerOf(node)!
    const item: any = {
      id: node.id ?? "",
      clickable: node.clickable === true,
      editable: node.editable === true,
      scrollable: node.scrollable === true,
      bounds: bounds.join(" "),
      centerX: center.x,
      centerY: center.y,
    }
    if (text) item.text = text
    if (desc) item.desc = desc
    elements.push(item)
  }
  return { elements }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// shortcut: this engine build (2.0.26) has no ctx.permission.assert (newer v2
// does), and Code Mode bypasses top-level rules for plugin tools. The trust
// gate is the app-side master switch checked by the bridge; restore per-call
// asserts when the engine is bumped.
function makeTools() {
  const bridgeTool = (
    name: string,
    description: string,
    input: Record<string, unknown>,
    run: (args: Args, signal?: AbortSignal) => Promise<string>,
  ) => ({
    name,
    description,
    input,
    execute: async (args: Args, context?: { signal?: AbortSignal }) => ({
      content: await run(args ?? {}, context?.signal),
    }),
  })

  const base = [
    bridgeTool(
      "mobile_ping",
      "Check the PhoneCanDo phone bridge. Returns {flavor, sdk, model, automation, unlocked, ui, pce}: flavor is full|play, unlocked is the phone-control gate, ui is the accessibility/PCE availability (compatibility alias), and pce is the PCE backend. Ungated and safe to call first or after any failure; play builds do not register the phone-control tools.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) => call("/ping", undefined, signal),
    ),
    bridgeTool(
      "mobile_battery",
      "Read the phone's battery. Ungated; returns {percent, charging} as reported by Android.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) => call("/battery", undefined, signal),
    ),
    bridgeTool(
      "mobile_notify",
      "Post an Android notification on the phone. text is required; title defaults to PhoneCanDo. Requires phone-control unlock in full builds and is ungated in play builds. Use only when the user asked for a notification or status update.",
      {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title (default PhoneCanDo)" },
          text: { type: "string", description: "Notification body" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      (args, signal) => call("/notify", { title: args.title, text: args.text }, signal),
    ),
    bridgeTool(
      "mobile_share",
      "Open the Android share sheet with text. title is an optional subject. Requires phone-control unlock in full builds; the user picks the target app. Returns an error if no app can handle the share.",
      {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to share" },
          title: { type: "string", description: "Optional subject/title" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      (args, signal) => call("/share", { text: args.text, title: args.title }, signal),
    ),
    bridgeTool(
      "mobile_open",
      "Open a URL with the phone's default app. This is NOT an app launcher: only http, https, mailto, tel, geo and market URLs are accepted, and app schemes such as whatsapp:// are rejected with bad_scheme. To launch an installed app use mobile_launch with its package name. Requires phone-control unlock in full builds; works while PhoneCanDo is in the foreground.",
      {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Absolute URL including scheme; scheme must be http, https, mailto, tel, geo or market",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      (args, signal) => call("/open", { url: args.url }, signal),
    ),
    bridgeTool(
      "mobile_clipboard",
      "Read or write the phone clipboard. action=get|set; text is required for set. Reading needs PhoneCanDo in the foreground on Android 10+ because the OS hides clipboard contents from background apps. Requires phone-control unlock in full builds.",
      {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get", "set"] },
          text: { type: "string", description: "Text to copy when action=set" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      (args, signal) => call("/clipboard", { action: args.action, text: args.text }, signal),
    ),
  ]

  const phone = [
    bridgeTool(
      "mobile_describe",
      "Describe the PCE automation without observing the screen. Returns contract, PCE version, backend, capabilities (observe/tap/long_press/set_text/key/scroll/swipe/launch), sdk, model, unlocked and installed packs. Requires phone-control unlock and the accessibility service; use mobile_ping for a cheap health check.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) => call("/pce/describe", undefined, signal),
    ),
    bridgeTool(
      "mobile_observe",
      "Observe the current screen and return a compact snapshot: snapshotId, package, activity, eventSeq, device/display, focused node id, windows, and nodes. Each node uses i as its node id plus cls, text, desc, id, bounds [l,t,r,b], parent and boolean flags. Pass the snapshotId to mobile_act; the snapshot becomes stale after the screen changes, so observe again. windows defaults true, includeInvisible defaults false, maxNodes defaults 500 and is clamped to 1..2000. screenshot=true requests an observation artifact on Android 11+; the returned screenshot.path is readable by the agent, so use it for visual verification instead of the reserved screenshot action.",
      {
        type: "object",
        properties: {
          screenshot: { type: "boolean", description: "Capture a screenshot artifact (Android 11+)" },
          includeInvisible: { type: "boolean", description: "Include nodes marked invisible" },
          windows: { type: "boolean", description: "Include window metadata (default true)" },
          maxNodes: { type: "number", description: "Node cap (default 500, max 2000)" },
        },
        additionalProperties: false,
      },
      (args, signal) =>
        call("/pce/observe", {
          screenshot: args.screenshot === true,
          includeInvisible: args.includeInvisible === true,
          windows: args.windows !== false,
          maxNodes: args.maxNodes,
        }, signal),
    ),
    bridgeTool(
      "mobile_act",
      "Run one typed PCE action against a snapshotId from mobile_observe. action is PCE JSON. Targets: {\"type\":\"node\",\"nodeId\":N} (preferred), {\"type\":\"selector\",\"selector\":{...}}, or {\"type\":\"coordinates\",\"point\":{\"x\":N,\"y\":N}}. Actions: tap; long_press (durationMs); type_text (text, target?, clear); key (ENTER|BACK|HOME|RECENTS|TAB|ESCAPE|UP|DOWN|LEFT|RIGHT|DELETE); scroll (UP|DOWN|LEFT|RIGHT, target?, amount); swipe (from,to,durationMs); wait (selector,timeoutMs); assert (selector); launch (packageName,activityName?). For launching an installed app prefer mobile_launch. screenshot is reserved and returns UNSUPPORTED_ACTION; use mobile_observe screenshot=true. Optional expect selector is a post-action wait; expectTimeoutMs defaults 5000.",
      {
        type: "object",
        properties: {
          snapshotId: { type: "number", description: "snapshotId from mobile_observe" },
          action: { type: "object", description: "PCE action JSON", additionalProperties: true },
          expect: { type: "object", description: "Selector to wait for after the action", additionalProperties: true },
          timeoutMs: { type: "number", description: "Action timeout (default 30000)" },
          expectTimeoutMs: { type: "number", description: "Postcondition wait (default 5000)" },
        },
        required: ["snapshotId", "action"],
        additionalProperties: false,
      },
      (args, signal) =>
        call("/pce/act", {
          snapshotId: args.snapshotId,
          action: args.action,
          expect: args.expect,
          timeoutMs: args.timeoutMs,
          expectTimeoutMs: args.expectTimeoutMs,
        }, signal, 35_000),
    ),
    bridgeTool(
      "mobile_launch",
      "Launch an installed Android app by package name, e.g. {\"packageName\":\"com.whatsapp\"}. Use this instead of mobile_open for apps; mobile_open only handles URLs. activityName is optional and is resolved relative to the package when it starts with '.' or has no dot. Requires phone-control unlock and the accessibility service. Returns {packageName, activityName} after the launch action; call mobile_wait or mobile_info to verify the foreground app. NOT_FOUND can mean the package is absent, disabled or hidden by Android package visibility; do not conclude it is missing. Fall back to mobile_home + launcher search and report not installed only after that UI search also fails.",
      {
        type: "object",
        properties: {
          packageName: { type: "string", description: "Android package name, e.g. com.whatsapp" },
          activityName: { type: "string", description: "Optional activity name; relative names are resolved against packageName" },
        },
        required: ["packageName"],
        additionalProperties: false,
      },
      (args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_pack",
      "List, refresh, roll back or run signed app packs. action=list returns each active pack's version, flows and parameters. action=refresh fetches manifestUrl (manifest.json; manifest.json.sig is fetched next to it), verifies every pack's sha256 and Ed25519 signature, then installs versions atomically; refresh is idempotent. action=rollback switches to the previous installed version and requires id. action=run requires id and flow, accepts string-only params, and returns each step's action and expect result. Requires phone-control unlock and the accessibility service; manifestUrl must be HTTPS, or loopback HTTP for local testing.",
      {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "refresh", "rollback", "run"] },
          manifestUrl: { type: "string", description: "HTTPS URL to manifest.json (loopback HTTP allowed for local testing); manifest.json.sig is fetched next to it" },
          id: { type: "string", description: "Pack id for rollback or run" },
          flow: { type: "string", description: "Flow id for run" },
          params: { type: "object", description: "String flow parameters for run", additionalProperties: true },
        },
        required: ["action"],
        additionalProperties: false,
      },
      (args, signal) =>
        call("/pce/pack", {
          action: args.action,
          manifestUrl: args.manifestUrl,
          id: args.id,
          flow: args.flow,
          params: args.params,
        }, signal, 120_000),
    ),
    bridgeTool(
      "mobile_screen",
      "Read the current screen as a flat list of visible elements that have text or a content description: {id, text?, desc?, bounds, centerX, centerY, clickable, editable, scrollable}. Use it for a quick human-readable dump; use mobile_observe when you need the full node tree or a snapshotId for mobile_act. scrollable=true keeps elements inside a scrollable ancestor; editable=true keeps editable fields. Click by text/desc/id with mobile_click, or tap centerX/centerY with mobile_tap.",
      {
        type: "object",
        properties: {
          scrollable: { type: "boolean", description: "Only elements inside a scrollable container" },
          editable: { type: "boolean", description: "Only editable fields" },
        },
        additionalProperties: false,
      },
      (args, signal) =>
        legacy(async () =>
          flatScreen(await observe({ maxNodes: 2000 }, signal), args.scrollable === true, args.editable === true),
        ),
    ),
    bridgeTool(
      "mobile_info",
      "Return the foreground app package, activity, windowPackage and windowChildCount. Use to verify an app launch or a screen switch. For the full tree, focused node or a snapshotId, use mobile_observe; for PCE capabilities use mobile_describe.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_click",
      "Click a visible element by text (case-insensitive contains), desc (contains) or id (exact resource id, e.g. com.app:id/button). It prefers a clickable node and walks up to a clickable parent; prefer this over coordinates. Only the first match is used, so use mobile_observe + mobile_act with a precise selector when duplicates matter. Requires phone-control unlock.",
      {
        type: "object",
        properties: {
          text: { type: "string", description: "Visible text (contains match)" },
          desc: { type: "string", description: "Content description (contains match)" },
          id: { type: "string", description: "Resource id, e.g. com.app:id/button" },
        },
        additionalProperties: false,
      },
      (args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_tap",
      "Tap absolute screen pixels at x,y. Use centerX/centerY from mobile_screen when no text/id matches; coordinates are physical pixels, not density-independent units. Prefer mobile_click for text/desc/id targets. Requires phone-control unlock.",
      {
        type: "object",
        properties: {
          x: { type: "number", description: "Absolute X" },
          y: { type: "number", description: "Absolute Y" },
        },
        required: ["x", "y"],
        additionalProperties: false,
      },
      (args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_text",
      "Type into the focused editable field, or the first visible editable field when none is focused. append=false replaces the field contents; append=true appends. Tap the field first when it is not focused. Retries once after 300ms if the field does not yet own input focus. Requires phone-control unlock; never use for OTPs or payment credentials.",
      {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to enter" },
          append: { type: "boolean", description: "Append instead of replacing" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      (args, signal) =>
        legacy(async () => {
          const text = String(args.text)
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
                  text,
                  target: { type: "node", nodeId: target.i },
                  clear: !append,
                },
                signal,
              )
              return {
                text: append ? previousText + text : text,
                previousText,
                action: append ? "append" : "set",
              }
            } catch (e) {
              // A tap can return before the field owns input focus.
              if (attempt > 0 || !/UNSUPPORTED_ACTION|NOT_EDITABLE/.test(String(e))) throw e
              await sleep(300)
            }
          }
        }),
    ),
    bridgeTool(
      "mobile_scroll",
      "Scroll a container up or down. direction=up|down; count repeats the scroll (default 1). target is optional text inside the container; without it the first visible scrollable container is used. The PCE sends a scroll action to that container, not a blind swipe. Use mobile_swipe for an arbitrary gesture. Requires phone-control unlock.",
      {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down"] },
          count: { type: "number", description: "Repeats (default 1)" },
          target: { type: "string", description: "Text inside the container to scroll" },
        },
        required: ["direction"],
        additionalProperties: false,
      },
      (args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_swipe",
      "Swipe between absolute screen coordinates, e.g. to dismiss a sheet or pull to refresh. x1,y1 is the start and x2,y2 the end; duration is in milliseconds (default 300). This is a raw gesture, not a scroll action; prefer mobile_scroll when a scrollable container is present. Requires phone-control unlock.",
      {
        type: "object",
        properties: {
          x1: { type: "number" },
          y1: { type: "number" },
          x2: { type: "number" },
          y2: { type: "number" },
          duration: { type: "number", description: "Milliseconds (default 300)" },
        },
        required: ["x1", "y1", "x2", "y2"],
        additionalProperties: false,
      },
      (args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_back",
      "Press the Android Back key. Use to dismiss a dialog, leave a screen or return from an app; verify with mobile_wait or mobile_info. Requires phone-control unlock.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) =>
        legacy(async () => {
          const snapshot = await observe({ maxNodes: 1 }, signal)
          await act(snapshot.snapshotId, { type: "key", key: "BACK" }, signal)
          return {}
        }),
    ),
    bridgeTool(
      "mobile_home",
      "Press the Android Home key. This backgrounds PhoneCanDo; with phone control enabled the host keeps the bridge alive, but prefer mobile_launch/mobile_open when you need another app and call mobile_return when the task is done. Requires phone-control unlock.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) =>
        legacy(async () => {
          const snapshot = await observe({ maxNodes: 1 }, signal)
          await act(snapshot.snapshotId, { type: "key", key: "HOME" }, signal)
          return {}
        }),
    ),
    bridgeTool(
      "mobile_wait",
      "Poll the observed screen until its package, activity, focused node, node signature or accessibility event sequence changes, or timeoutMs expires (default 5000, max 12000). Returns {changed, timeoutMs, package, activity}; changed=false means no change was seen before the deadline. The accessibility event counter catches a change that reverted between polls. Use after a tap/launch instead of a blind sleep; for a specific element use mobile_act wait or expect. Requires phone-control unlock.",
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number", description: "Max wait in ms (default 5000, max 12000)" },
        },
        additionalProperties: false,
      },
      (args, signal) =>
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
        }),
    ),
    bridgeTool(
      "mobile_return",
      "Bring PhoneCanDo back to the foreground after finishing a phone-control task. tab=home|env|settings (default home). When PhoneCanDo is backgrounded it also posts a tap-to-return notification and reports notified:true; tell the user to tap it if the app did not come forward. Call this before your final report. Ungated; registered in full builds.",
      {
        type: "object",
        properties: {
          tab: {
            type: "string",
            enum: ["home", "env", "settings"],
            description: "Tab to show after returning (default home)",
          },
        },
        additionalProperties: false,
      },
      (args, signal) =>
        call("/app", {
          tab: args.tab ?? "home",
          notify: true,
          reason: "return",
        }, signal),
    ),
    bridgeTool(
      "mobile_request_unlock",
      "Phone control is locked (automation_off). Show the biometric/PIN prompt over the chat and wait up to 45s for the user. This never unlocks by itself. If the result has unlocked:true, continue the task; if unlocked:false, stop and ask the user to unlock. Never retry the locked action or try to bypass the gate.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) => call("/unlock", { waitMs: 45_000 }, signal, 50_000),
    ),
    bridgeTool(
      "mobile_open_accessibility",
      "UI automation is unavailable because Android's accessibility service is off (automation_unavailable). Show an in-chat confirmation, then open Android Accessibility settings and wait up to ~60s for PhoneCanDo's service to connect. This never enables it; the user must flip the system toggle. If enabled:true, continue. If enabled:false, stop and ask the user to enable it and tell you when done, then call mobile_ping and continue only when it reports ui:true. Never toggle accessibility yourself.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) =>
        call("/accessibility", { waitMs: 20_000, enableMs: 40_000 }, signal, 65_000),
    ),
  ]
  return PHONE_CONTROL ? [...base, ...phone] : base
}

export default Plugin.define({
  id: "phonecando.mobile",
  async setup(ctx) {
    const tools = makeTools()
    await ctx.tool.transform((editor) => {
      for (const tool of tools) editor.add(tool)
    })
  },
})
