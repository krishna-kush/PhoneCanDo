# Plan: 2026-11-16-0750-w2-4-chat-storage

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** W2-4 ([builds.md](../../../../builds.md)), installed 2026-11-16 07:45.
- **Time budget:** about 30 minutes. The 0.8B reads a full prompt in 3 to 6
  minutes; only turns A and B should take that long.
- **Human steps allowed:** none.

## Cases

- [MODEL-15](../../../../cases/local-models.md#model-15) Each model's memory is measured, and the Memory page says so
- [MODEL-02](../../../../cases/local-models.md#model-02) Two chats take turns: turn C reuses its saved state
- [MODEL-13](../../../../cases/local-models.md#model-13) Chats that take turns come back from storage
- [MODEL-14](../../../../cases/local-models.md#model-14) Saved chat files are private to the app

## Steps

1. Open the app once (so it measures its models), wait a minute, then run
   MODEL-15.
2. Make sure only A-04 and A-10 use the 0.8B and the other agents on it are
   stopped. Then run MODEL-02's three turns, reading the logs as MODEL-13
   says. MODEL-02 and MODEL-13 share these turns.
3. Run MODEL-14.
