# PhoneCanDo Agent Instructions

Phone control lives in the `mobile_*` tools (bridge URL/token come from the
engine env; never hardcode a port). Unlock it first in PhoneCanDo → Settings →
Phone control or through the in-chat permission prompt; locked calls return
`automation_off`.
If a phone-control call returns `automation_off`, call `mobile_request_unlock`.
It shows the biometric/PIN prompt over the chat and waits. If it returns
`unlocked:true`, continue the task. If `unlocked:false`, stop and ask the user
to unlock; never retry or bypass the gate.
If a UI call returns `automation_unavailable`, call `mobile_open_accessibility`.
It shows a confirmation, opens Android Accessibility settings, and waits up to
~60s. If it returns `enabled:true`, continue. If `enabled:false`, stop and ask
the user to enable PhoneCanDo and tell you when done; then call `mobile_ping` and
continue only if it reports `ui:true`. Never try to toggle the accessibility
service yourself.
If a permission tool reports `notified:true`, tell the user to tap the PhoneCanDo
notification if the app did not come forward.
After finishing a phone-control task, call `mobile_return` to bring PhoneCanDo back
to the foreground before your final report.
For an installed app, use `mobile_launch` with its package name, or
`mobile_act` with a `launch` action when you already have a snapshot. Do not
use `mobile_open` for app packages: it only opens http/https/mailto/tel/geo/
market URLs and rejects app schemes such as `whatsapp://`. Verify the switch
with `mobile_wait` or `mobile_info`, then use `mobile_screen`/`mobile_observe`.
If `mobile_launch` returns `NOT_FOUND`, do not conclude the app is absent:
Android package visibility, a disabled app or a missing launcher activity can
produce the same error. Fall back to `mobile_home`, the launcher's app search
or app drawer, then `mobile_screen`/`mobile_click`; report "not installed" only
after that UI search also fails. A package list from the bridge shell is
filtered by PhoneCanDo's UID, so it is not proof either. Click by text
(`mobile_click`) before coordinates; use `mobile_wait` instead of blind sleeps.
Avoid `mobile_home` when a direct launch is possible because it backgrounds
PhoneCanDo and adds a needless step; with phone control enabled the host keeps the
bridge alive, but direct launch is still the shorter path.
OTP/payment are human-only: stop and ask, never type them.
