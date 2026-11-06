import { Plugin } from "@opencode/plugin"
import { bridgeTool, call, type Args } from "../mobile/shared"

// Full-channel phone control. This plugin folder is excluded from lite/play
// agent configs, so those builds carry no PCE or accessibility tool code.
const PHONE_CONTROL = (process.env.PHONECANDO_CHANNEL ?? "full") === "full"

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

// Client timeout for one mobile_act call, from the bridge's caps
// (PceAutomationImpl.act): timeoutMs is clamped to 1-120 s (default 30 s)
// and bounds a wait; expectTimeoutMs to 0.5-30 s (default 5 s), used only
// with expect. The margin covers the last observe a wait runs before giving
// up. A fixed 35 s ended long waits in a client timeout while the action kept
// running. Stays under 280 s; HTTP clients give up near 300 s.
function actTimeoutMs(args: Args): number {
  const ms = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  const action = ms(args.timeoutMs, 1_000, 120_000, 30_000)
  const expect = args.expect ? ms(args.expectTimeoutMs, 500, 30_000, 5_000) : 0
  return Math.min(280_000, action + expect + 10_000)
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

function makeTools() {
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
      "Run one typed PCE action against a snapshotId from mobile_observe. action is PCE JSON. Targets: {\"type\":\"node\",\"nodeId\":N} (preferred), {\"type\":\"selector\",\"selector\":{...}}, or {\"type\":\"coordinates\",\"point\":{\"x\":N,\"y\":N}}. Actions: tap; long_press (durationMs); type_text (text, target?, clear); key (ENTER|BACK|HOME|RECENTS|TAB|ESCAPE|UP|DOWN|LEFT|RIGHT|DELETE); scroll (UP|DOWN|LEFT|RIGHT, target?, amount); swipe (from,to,durationMs); wait (selector,timeoutMs); assert (selector); launch (packageName,activityName?). For launching an installed app prefer mobile_launch. screenshot is reserved and returns UNSUPPORTED_ACTION; use mobile_observe screenshot=true. Optional expect selector is a post-action wait. timeoutMs (default 30000, clamped to 1000..120000) caps a wait action, which ends at the smaller of its own timeoutMs and this one; expectTimeoutMs (default 5000, clamped to 500..30000) caps the expect wait. The call waits for both plus 10 s, so a slow wait returns its own TIMEOUT error.",
      {
        type: "object",
        properties: {
          snapshotId: { type: "number", description: "snapshotId from mobile_observe" },
          action: { type: "object", description: "PCE action JSON", additionalProperties: true },
          expect: { type: "object", description: "Selector to wait for after the action", additionalProperties: true },
          timeoutMs: { type: "number", description: "Action timeout (default 30000, max 120000)" },
          expectTimeoutMs: { type: "number", description: "Postcondition wait (default 5000, max 30000)" },
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
        }, signal, actTimeoutMs(args)),
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
      "UI automation is unavailable because Android's accessibility service is off (automation_unavailable). Shows PhoneCanDo's setup dialog over the chat and waits up to 4 minutes while the user follows it, returning as soon as the service connects. This never enables anything; only the user can flip the switch. Returns {opened, enabled, cancelled, restricted}. If enabled:true, continue the task right away. If cancelled:true, the user tapped 'Not now': stop and ask whether to continue. Otherwise (enabled:false after the wait), tell the user to finish the steps shown in PhoneCanDo and say when done; when they do, call mobile_ping and continue only when it reports ui:true. Do not call this again in a loop. restricted is 'sideload' when the user went through PhoneCanDo's restricted-settings guide (Android locks the switch for apps installed from a file: Android's 'Restricted setting' note, then App info → Allow restricted settings, then the switch). Never toggle accessibility yourself.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args, signal) =>
        // The bridge waits up to waitMs for the service; the client allows a
        // little more. Both stay under five minutes, where HTTP clients give up.
        call("/accessibility", { waitMs: 240_000 }, signal, 255_000),
    ),
  ]
  return PHONE_CONTROL ? phone : []
}

export default Plugin.define({
  id: "phonecando.automation",
  async setup(ctx) {
    const tools = makeTools()
    await ctx.tool.transform((editor) => {
      for (const tool of tools) editor.add(tool)
    })
  },
})
