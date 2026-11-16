# Phone tests

What has been tried on a real phone, on which build, with which agents, and
what came out. It is for people and for AI agents picking or running the
next test.

> **Warning: an AI ran every test here, not me.** Each result comes from an
> AI model, Claude Opus 5.5 at effort xhigh, driving our test phone over adb
> on its own, with no human stepping in. The few places where I did step in
> are marked in their row. Don't read a pass here as tested by me, the
> developer. With time, I'll test all myself and update this note.
>
> The AI tester's prompt told it to read no code and test only through adb.
> It was told to check the screen with `uiautomator dump`, and to take no
> screenshot until it couldn't go on without one. It took them where dumps
> fail: the drawer, Home, agents' terminals, and screens still moving. The
> prompt also told it never to print secrets, to prefer new chats over
> existing ones, and to report which chats it touched. These rules now live
> in [tester/AGENTS.md](tester/AGENTS.md).

## What is here

```
status.md          latest result of every case, one column per phone
builds.md          every build tested, and its rounds (add-only)
cases/<area>.md    the cases: how to run each one and what to expect
tester/            for AI testers: AGENTS.md (rules), prompt.md, results.md (the shape)
phones/<phone>/
  phone.md         the phone, its agents and models, its quirks
  rounds/<YYYY-MM-DD-HHMM>-<build>-<slug>/
    plan.md        the cases this round runs, linked, and its steps
    prompt.md      the prompt the tester got
    results.md     one row per case, with evidence
    evidence/      short text excerpts (logs, tool results); no screenshots
```

Results depend on the phone, so each phone has its own folder. Today there
is one: [moto g96 5G](phones/moto-g96-5g/phone.md).

## How to read it

- Find a test's latest result in [status.md](status.md).
- Find what a round ran in its `plan.md`, and what came out in its
  `results.md`.
- Search an ID (such as `MSG-08`) to find everything about it: its case,
  every plan that ran it, every result.

Cases, `status.md`, `phone.md` and `tester/` are living: edit them as the
app changes. A round's folder is frozen once its results are in: a later
fix goes in a dated note at the end of `results.md`, never as an edit to
its results. `builds.md` is add-only.

## IDs and names

- A case ID is its area and a number: `ACP-01`, `CHECK-01`, `SCHED-01`,
  `MSG-01`, `LIFE-01`, `BACK-01`, `MODEL-01`, `PAGE-01`. Write it exactly
  so everywhere, so a search finds it. Its heading is `### ID Title`, and
  its anchor is the ID in lower case (`cases/messages.md#msg-08`).
- An ID never changes and is never used again. A dropped case stays in its
  file, marked **Retired**, with why. A new case takes the next free number
  in its area.
- A round's folder is named by the local time it started, its build and a
  short slug: `2026-11-15-1911-w2-3-wake-burst`. Names sort by time and
  never clash.
- Results: **Pass**, **Fail**, **Flaky**, **Blocked**, **Not run**;
  [tester/AGENTS.md](tester/AGENTS.md) says when each applies.
  [status.md](status.md) also uses **Fixed**: a Pass after a Fail.

## Start a new round

1. New build on the phone: add its row to [builds.md](builds.md).
2. New test ideas: add them as cases first, with the next free IDs.
3. Make the round's folder:
   `phones/<phone>/rounds/<YYYY-MM-DD-HHMM>-<build>-<slug>/`.
4. Write its `plan.md`: the phone, the build, and the case IDs it runs,
   each linked to its case. Pick from [status.md](status.md): every Fail,
   Flaky, Blocked and Not run, plus the cases whose Touches line matches
   what the build changed, plus a few quick basics. Add steps only where a
   case's own steps aren't enough, and a time budget.
5. Copy [tester/prompt.md](tester/prompt.md) into the round's `prompt.md`,
   fill in `{round}`, `{phone}`, `{model}` and `{effort}`, and start the
   tester with it. One tester per phone at a time.
6. The tester writes `results.md` and `evidence/`, and nothing else. Its
   notes and screenshots stay outside the repo.
7. Read the results and the evidence of every Fail. Mark any step I took.
8. Roll up: in [status.md](status.md), change the cells of the cases the
   round ran (result, build, date, link to its `results.md`); add the round
   to its build's row in [builds.md](builds.md); add new bugs to
   `docs/planning/todo.md` and to the open issues in
   [status.md](status.md).

The rounds before 2026-11-16 were back-filled from the old
`phone-tests.md` and the testers' notes; their plans and prompts say what
was rebuilt.
