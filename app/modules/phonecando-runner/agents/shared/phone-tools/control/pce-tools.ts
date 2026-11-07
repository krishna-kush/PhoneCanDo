import { call } from "../client"
import { noArgs, type PhoneTool } from "../tool"
import { actTimeoutMs } from "./pce"

// The typed PCE tools: one bridge route each.
export const pceTools: PhoneTool[] = [
  {
    name: "mobile_describe",
    description:
      "Describe the PCE automation without observing the screen. Returns contract, PCE version, backend, capabilities (observe/tap/long_press/set_text/key/scroll/swipe/launch), sdk, model, unlocked and installed packs. Requires phone-control unlock and the accessibility service; use mobile_ping for a cheap health check.",
    input: noArgs,
    channel: "full",
    run: (_args, signal) => call("/pce/describe", undefined, signal),
  },
  {
    name: "mobile_observe",
    description:
      "Observe the current screen and return a compact snapshot: snapshotId, package, activity, eventSeq, device/display, focused node id, windows, and nodes. Each node uses i as its node id plus cls, text, desc, id, bounds [l,t,r,b], parent and boolean flags. Pass the snapshotId to mobile_act; the snapshot becomes stale after the screen changes, so observe again. windows defaults true, includeInvisible defaults false, maxNodes defaults 500 and is clamped to 1..2000. screenshot=true requests an observation artifact on Android 11+; the returned screenshot.path is readable by the agent, so use it for visual verification instead of the reserved screenshot action.",
    input: {
      type: "object",
      properties: {
        screenshot: { type: "boolean", description: "Capture a screenshot artifact (Android 11+)" },
        includeInvisible: { type: "boolean", description: "Include nodes marked invisible" },
        windows: { type: "boolean", description: "Include window metadata (default true)" },
        maxNodes: { type: "number", description: "Node cap (default 500, max 2000)" },
      },
      additionalProperties: false,
    },
    channel: "full",
    run: (args, signal) =>
      call("/pce/observe", {
        screenshot: args.screenshot === true,
        includeInvisible: args.includeInvisible === true,
        windows: args.windows !== false,
        maxNodes: args.maxNodes,
      }, signal),
  },
  {
    name: "mobile_act",
    description:
      "Run one typed PCE action against a snapshotId from mobile_observe. action is PCE JSON. Targets: {\"type\":\"node\",\"nodeId\":N} (preferred), {\"type\":\"selector\",\"selector\":{...}}, or {\"type\":\"coordinates\",\"point\":{\"x\":N,\"y\":N}}. Actions: tap; long_press (durationMs); type_text (text, target?, clear); key (ENTER|BACK|HOME|RECENTS|TAB|ESCAPE|UP|DOWN|LEFT|RIGHT|DELETE); scroll (UP|DOWN|LEFT|RIGHT, target?, amount); swipe (from,to,durationMs); wait (selector,timeoutMs); assert (selector); launch (packageName,activityName?). For launching an installed app prefer mobile_launch. screenshot is reserved and returns UNSUPPORTED_ACTION; use mobile_observe screenshot=true. Optional expect selector is a post-action wait. timeoutMs (default 30000, clamped to 1000..120000) caps a wait action, which ends at the smaller of its own timeoutMs and this one; expectTimeoutMs (default 5000, clamped to 500..30000) caps the expect wait. The call waits for both plus 10 s, so a slow wait returns its own TIMEOUT error.",
    input: {
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
    channel: "full",
    run: (args, signal) =>
      call("/pce/act", {
        snapshotId: args.snapshotId,
        action: args.action,
        expect: args.expect,
        timeoutMs: args.timeoutMs,
        expectTimeoutMs: args.expectTimeoutMs,
      }, signal, actTimeoutMs(args)),
  },
  {
    name: "mobile_pack",
    description:
      "List, refresh, roll back or run signed app packs. action=list returns each active pack's version, flows and parameters. action=refresh fetches manifestUrl (manifest.json; manifest.json.sig is fetched next to it), verifies every pack's sha256 and Ed25519 signature, then installs versions atomically; refresh is idempotent. action=rollback switches to the previous installed version and requires id. action=run requires id and flow, accepts string-only params, and returns each step's action and expect result. Requires phone-control unlock and the accessibility service; manifestUrl must be HTTPS, or loopback HTTP for local testing.",
    input: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "refresh", "rollback", "run"] },
        manifestUrl: {
          type: "string",
          description: "HTTPS URL to manifest.json (loopback HTTP allowed for local testing); manifest.json.sig is fetched next to it",
        },
        id: { type: "string", description: "Pack id for rollback or run" },
        flow: { type: "string", description: "Flow id for run" },
        params: { type: "object", description: "String flow parameters for run", additionalProperties: true },
      },
      required: ["action"],
      additionalProperties: false,
    },
    channel: "full",
    run: (args, signal) =>
      call("/pce/pack", {
        action: args.action,
        manifestUrl: args.manifestUrl,
        id: args.id,
        flow: args.flow,
        params: args.params,
      }, signal, 120_000),
  },
]
