# Plan: 2026-11-15-1216-acp-two-chats-before

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** ACP ([builds.md](../../../../builds.md))
- **Source:** rebuilt on 2026-11-16 from the tester's notes. The plan it
  read was not kept. This is the "before" run for the wave 2 fix to two
  chats taking turns on one local model; the same steps ran again on W2-1
  and W2-2.

## Cases

- [MODEL-01](../../../../cases/local-models.md#model-01) One chat alone reuses its prompt
- [MODEL-02](../../../../cases/local-models.md#model-02) Two chats take turns: turn C reuses its saved state

## Steps

1. Before the tester starts, a script on the PC copies every model server
   log off the phone once a minute, so a server restart can't wipe the run.
2. Test 1 ([MODEL-01](../../../../cases/local-models.md#model-01)): in
   Claude Code A-04 (0.8B), /clear, then give it a task that takes many
   requests, and allow its permission questions. Save the model log.
3. Test 2 ([MODEL-02](../../../../cases/local-models.md#model-02)): turn A
   in A-04 (after /clear): "Say hello in one short line." Turn B in Codex
   A-10 (a fresh chat): the same. Turn C in A-04, same chat: "Now say
   goodbye in one short line." Save the model log.
