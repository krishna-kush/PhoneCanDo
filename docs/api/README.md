# Automation contract (v1)

This is the design for the automation layer the AI drives. It is not a driver
or a tool list. It is a versioned contract plus a runtime that can be updated
at three different speeds.

The contract is the product. The a11y driver is one backend behind it.
Shizuku is another. Vision is a third. Any of them can be replaced without
changing what the AI sees.

This tree describes the **host-facing** automation contract: the `mobile_*`
tools exposed by the opencode plugin and the `/pce/*` bridge routes.

It is not the PCE Kotlin library API. `pce/docs/api/` documents how a host
embeds the PCE (`Pce`, `Backend`, `Snapshot`, `Action`, `PceResult`); this tree
documents what the AI sees and sends over the bridge. The two share concepts
and names, but neither replaces the other.

## Reading order

1. `mental-model.md` — layers, update speeds and the reason the contract is
   updatable.
2. `tools.md` — the AI-facing tool surface.
3. `snapshots.md` — observation payloads and screenshot rules.
4. `selectors.md` — how selectors resolve.
5. `actions.md` — the typed action registry.
6. `errors.md` — structured failures and recovery.
7. `packs.md` — signed app knowledge.
8. `backends.md` — backend contract and v1 routing.
9. `security.md` — trust gate, allowlists and audit.

Implementation status and device proof live in `../../app/docs/modules/automation.md`.
Cross-module limits are in `../release/known-limits.md`.
