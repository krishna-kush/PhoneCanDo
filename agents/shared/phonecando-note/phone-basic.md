## Phone tools

This build has no phone-control or accessibility tools. Do not try to unlock
phone control, read the screen, tap, launch apps, or install the accessibility
service; those tools are not registered.

The basic tools (`mobile_ping`, `mobile_battery`, `mobile_notify`,
`mobile_share`, `mobile_open`, `mobile_clipboard`) are available through the
phone bridge. Use them only when the user asks for that action. Otherwise use
the normal terminal, file, web, and chat tools.
