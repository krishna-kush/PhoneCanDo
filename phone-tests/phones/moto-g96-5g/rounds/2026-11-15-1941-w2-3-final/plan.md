# Plan: 2026-11-15-1941-w2-3-final

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** W2-3 ([builds.md](../../../../builds.md))
- **Source:** rebuilt on 2026-11-16 from the tester's notes. It ran the
  rest of [the W2-3 plan](../2026-11-15-1911-w2-3-wake-burst/plan.md):
  test 1's steps 5 and 6 with a cloud-model agent in place of A-04, then
  tests 2 to 4. The session that started the tester finished test 4 on
  2026-11-16.

## Cases

- [MSG-10](../../../../cases/messages.md#msg-10) An answer to a waking message wakes the agent that asked
- [MSG-11](../../../../cases/messages.md#msg-11) A reply to that answer doesn't wake anyone (hop limit)
- [MODEL-07](../../../../cases/local-models.md#model-07) Saving a Memory page change, then setting it back
- [LIFE-04](../../../../cases/lifecycle.md#life-04) Quitting an agent's own app on purpose gives no "stopped by itself" notice
- [BACK-01](../../../../cases/bring-back.md#back-01) A run cut off by a reboot is offered back, and Continue goes on in the same chat

## Steps

1. Stop A-04 (still working from the last round), so the steps don't wait
   on the 0.8B. As the answering agent, pick a stopped cloud-model agent
   whose "Other agents can wake it" is on: A-12 ("opencode 8").
2. (MSG-10) In A-01, a new session: send "opencode 8" a waking message,
   "reply to me with the word hi", and end the turn. Its answer should wake
   A-01 by itself.
3. (MSG-11) In A-01: reply to the answer with agents_send, replyTo set to
   its message id, text "thanks", wake true. It should not wake anyone.
4. MODEL-07, LIFE-04 and BACK-01: as tests 2, 3 and 4 of
   [the W2-3 plan](../2026-11-15-1911-w2-3-wake-burst/plan.md). For BACK-01,
   use ten `sleep 100` runs one after another as the long task.
