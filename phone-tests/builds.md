# Builds

Every build that went on a test phone, and the rounds that tested it.
Add-only: add a row for a new build, and add a round to its row when one
runs. Never change what an old row says.

All builds so far are PhoneCanDo Full Dev (`com.phonecando.app.full.dev`),
0.1.2 (3), a debug build with JS from Metro.

| Build | What it holds | On the phone | Rounds on moto g96 5G |
|---|---|---|---|
| ACP | ACP mode, the custom agent form, the tap fix, capability checks (commits a204117..97a3802) | 2026-11-14 until W2-1; its last build was made 2026-11-15 08:17 and installed 08:26 | [2026-11-14-1423-acp-first-look](phones/moto-g96-5g/rounds/2026-11-14-1423-acp-first-look/results.md), [2026-11-14-1647-acp-regression](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md), [2026-11-15-0321-acp-morning](phones/moto-g96-5g/rounds/2026-11-15-0321-acp-morning/results.md), [2026-11-15-1216-acp-two-chats-before](phones/moto-g96-5g/rounds/2026-11-15-1216-acp-two-chats-before/results.md) |
| W2-1 | ACP plus wave 2, before the review fixes | installed 2026-11-15 13:46 | [2026-11-15-1347-w2-1-first](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md), [2026-11-15-1509-w2-1-own-apps](phones/moto-g96-5g/rounds/2026-11-15-1509-w2-1-own-apps/results.md) |
| W2-2 | W2-1 plus the review fixes, the Gemini fixes, the Check now Stop fix, and half-size notes to fit a saved chat | installed 2026-11-15 17:28 | [2026-11-15-1729-w2-2-retest](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| W2-3 | W2-2 plus an answer to a waking message waking the agent that asked | installed 2026-11-15 19:11 | [2026-11-15-1911-w2-3-wake-burst](phones/moto-g96-5g/rounds/2026-11-15-1911-w2-3-wake-burst/results.md), [2026-11-15-1941-w2-3-final](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |
| W2-4 | W2-3 plus: opencode's inbox events and your own shell no longer read as working, a server's working chats checked against the server, bring-back offers no run stale for an hour, the reason a message didn't wake, bridge bodies read as UTF-8, the Memory page's saved-chats line, each model server's memory measured by llama.cpp's own dry run, and chats that take turns kept on storage | installed 2026-11-16 07:45 | [2026-11-16-0750-w2-4-chat-storage](phones/moto-g96-5g/rounds/2026-11-16-0750-w2-4-chat-storage/results.md) |
