import { noArgs, type PhoneTool } from "../tool"
import * as composed from "./composed"

// The compatibility tools, thin wrappers over the typed PCE API
// (composed.ts). Keep their names stable: prompts and saved chats already
// use them.
export const screenTools: PhoneTool[] = [
  {
    name: "mobile_launch",
    description:
      "Launch an installed Android app by package name, e.g. {\"packageName\":\"com.whatsapp\"}. Use this instead of mobile_open for apps; mobile_open only handles URLs. activityName is optional and is resolved relative to the package when it starts with '.' or has no dot. Requires phone-control unlock and the accessibility service. Returns {packageName, activityName} after the launch action; call mobile_wait or mobile_info to verify the foreground app. NOT_FOUND can mean the package is absent, disabled or hidden by Android package visibility; do not conclude it is missing. Fall back to mobile_home + launcher search and report not installed only after that UI search also fails.",
    input: {
      type: "object",
      properties: {
        packageName: { type: "string", description: "Android package name, e.g. com.whatsapp" },
        activityName: {
          type: "string",
          description: "Optional activity name; relative names are resolved against packageName",
        },
      },
      required: ["packageName"],
      additionalProperties: false,
    },
    channel: "full",
    run: composed.launch,
  },
  {
    name: "mobile_screen",
    description:
      "Read the current screen as a flat list of visible elements that have text or a content description: {id, text?, desc?, bounds, centerX, centerY, clickable, editable, scrollable}. Use it for a quick human-readable dump; use mobile_observe when you need the full node tree or a snapshotId for mobile_act. scrollable=true keeps elements inside a scrollable ancestor; editable=true keeps editable fields. Click by text/desc/id with mobile_click, or tap centerX/centerY with mobile_tap.",
    input: {
      type: "object",
      properties: {
        scrollable: { type: "boolean", description: "Only elements inside a scrollable container" },
        editable: { type: "boolean", description: "Only editable fields" },
      },
      additionalProperties: false,
    },
    channel: "full",
    run: composed.screen,
  },
  {
    name: "mobile_info",
    description:
      "Return the foreground app package, activity, windowPackage and windowChildCount. Use to verify an app launch or a screen switch. For the full tree, focused node or a snapshotId, use mobile_observe; for PCE capabilities use mobile_describe.",
    input: noArgs,
    channel: "full",
    run: composed.info,
  },
  {
    name: "mobile_click",
    description:
      "Click a visible element by text (case-insensitive contains), desc (contains) or id (exact resource id, e.g. com.app:id/button). It prefers a clickable node and walks up to a clickable parent; prefer this over coordinates. Only the first match is used, so use mobile_observe + mobile_act with a precise selector when duplicates matter. Requires phone-control unlock.",
    input: {
      type: "object",
      properties: {
        text: { type: "string", description: "Visible text (contains match)" },
        desc: { type: "string", description: "Content description (contains match)" },
        id: { type: "string", description: "Resource id, e.g. com.app:id/button" },
      },
      additionalProperties: false,
    },
    channel: "full",
    run: composed.click,
  },
  {
    name: "mobile_tap",
    description:
      "Tap absolute screen pixels at x,y. Use centerX/centerY from mobile_screen when no text/id matches; coordinates are physical pixels, not density-independent units. Prefer mobile_click for text/desc/id targets. Requires phone-control unlock.",
    input: {
      type: "object",
      properties: {
        x: { type: "number", description: "Absolute X" },
        y: { type: "number", description: "Absolute Y" },
      },
      required: ["x", "y"],
      additionalProperties: false,
    },
    channel: "full",
    run: composed.tap,
  },
  {
    name: "mobile_text",
    description:
      "Type into the focused editable field, or the first visible editable field when none is focused. append=false replaces the field contents; append=true appends. Tap the field first when it is not focused. Retries once after 300ms if the field does not yet own input focus. Requires phone-control unlock; never use for OTPs or payment credentials.",
    input: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to enter" },
        append: { type: "boolean", description: "Append instead of replacing" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    channel: "full",
    run: composed.text,
  },
  {
    name: "mobile_scroll",
    description:
      "Scroll a container up or down. direction=up|down; count repeats the scroll (default 1). target is optional text inside the container; without it the first visible scrollable container is used. The PCE sends a scroll action to that container, not a blind swipe. Use mobile_swipe for an arbitrary gesture. Requires phone-control unlock.",
    input: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        count: { type: "number", description: "Repeats (default 1)" },
        target: { type: "string", description: "Text inside the container to scroll" },
      },
      required: ["direction"],
      additionalProperties: false,
    },
    channel: "full",
    run: composed.scroll,
  },
  {
    name: "mobile_swipe",
    description:
      "Swipe between absolute screen coordinates, e.g. to dismiss a sheet or pull to refresh. x1,y1 is the start and x2,y2 the end; duration is in milliseconds (default 300). This is a raw gesture, not a scroll action; prefer mobile_scroll when a scrollable container is present. Requires phone-control unlock.",
    input: {
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
    channel: "full",
    run: composed.swipe,
  },
  {
    name: "mobile_back",
    description:
      "Press the Android Back key. Use to dismiss a dialog, leave a screen or return from an app; verify with mobile_wait or mobile_info. Requires phone-control unlock.",
    input: noArgs,
    channel: "full",
    run: composed.back,
  },
  {
    name: "mobile_home",
    description:
      "Press the Android Home key. This backgrounds PhoneCanDo; with phone control enabled the host keeps the bridge alive, but prefer mobile_launch/mobile_open when you need another app and call mobile_return when the task is done. Requires phone-control unlock.",
    input: noArgs,
    channel: "full",
    run: composed.home,
  },
  {
    name: "mobile_wait",
    description:
      "Poll the observed screen until its package, activity, focused node, node signature or accessibility event sequence changes, or timeoutMs expires (default 5000, max 12000). Returns {changed, timeoutMs, package, activity}; changed=false means no change was seen before the deadline. The accessibility event counter catches a change that reverted between polls. Use after a tap/launch instead of a blind sleep; for a specific element use mobile_act wait or expect. Requires phone-control unlock.",
    input: {
      type: "object",
      properties: {
        timeoutMs: { type: "number", description: "Max wait in ms (default 5000, max 12000)" },
      },
      additionalProperties: false,
    },
    channel: "full",
    run: composed.wait,
  },
]
