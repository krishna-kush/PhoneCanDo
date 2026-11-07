// Pure reads of a PCE snapshot ({snapshotId, package, activity, focused,
// device, nodes}) for the composed tools: visibility, targets and change
// detection. No bridge calls here.

export function boundsOf(node: any): [number, number, number, number] | null {
  const b = node?.bounds
  return Array.isArray(b) && b.length === 4 && b.every((v: any) => typeof v === "number") ? b : null
}

export function centerOf(node: any): { x: number; y: number } | null {
  const b = boundsOf(node)
  return b ? { x: Math.floor((b[0] + b[2]) / 2), y: Math.floor((b[1] + b[3]) / 2) } : null
}

export function visible(node: any, snapshot: any): boolean {
  const b = boundsOf(node)
  const c = centerOf(node)
  if (!b || !c || b[2] <= b[0] || b[3] <= b[1] || node?.visible === false) return false
  const display = snapshot?.device?.display
  return !Array.isArray(display) || (c.x >= 0 && c.x < display[0] && c.y >= 0 && c.y < display[1])
}

export function nodeMap(snapshot: any): Map<number, any> {
  return new Map((snapshot?.nodes ?? []).map((n: any) => [n.i, n]))
}

export function clickableParent(map: Map<number, any>, node: any, snapshot: any): any | null {
  let current = map.get(node?.parent)
  for (let depth = 0; current && depth < 5; depth++) {
    if (current.clickable === true && visible(current, snapshot)) return current
    current = map.get(current.parent)
  }
  return null
}

export function scrollableAncestor(map: Map<number, any>, node: any): any | null {
  let current = node
  for (let depth = 0; current && depth < 10; depth++) {
    if (current.scrollable === true) return current
    current = map.get(current.parent)
  }
  return null
}

export function firstScrollable(snapshot: any): any | null {
  return (snapshot?.nodes ?? []).find((n: any) => n.scrollable === true && visible(n, snapshot)) ?? null
}

export function textNode(snapshot: any, text: string): any | null {
  const needle = text.toLowerCase()
  return (snapshot?.nodes ?? []).find(
    (n: any) => visible(n, snapshot) && typeof n.text === "string" && n.text.toLowerCase().includes(needle),
  ) ?? null
}

export function editableTarget(snapshot: any): any | null {
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
export function observationKey(snapshot: any): string {
  const sig = signature(snapshot)
  return typeof snapshot?.eventSeq === "number"
    ? `seq:${snapshot.eventSeq}|${sig}`
    : sig
}

export function flatScreen(snapshot: any, onlyScrollable: boolean, onlyEditable: boolean): any {
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
