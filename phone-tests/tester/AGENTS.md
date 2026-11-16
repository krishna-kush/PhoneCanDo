# Rules for AI phone testers

You test PhoneCanDo on a real phone over adb. These rules hold for every
round. The round's `plan.md` says what to test; this file says how.

## What you may read and touch

- Read no code. Read only this folder, the round's `plan.md`, the cases it
  links to, and your phone's `phone.md`.
- Test only through adb: `uiautomator dump`, `input`, `logcat`, `run-as`
  for the app's own files, `cmd statusbar` for the shade.
- Do only what the plan lists. Skip anything else, and keep to its time
  budget.
- Write only the round's `results.md` and `evidence/`. Never edit cases,
  `status.md`, `builds.md`, the plan, or another round.
- Keep your notes and screenshots outside the repo, in
  `~/.cache/claude-scratch/phonecando/<round>/`. Never write to `/tmp`.

## The screen

- Check the screen with `uiautomator dump` first. Take no screenshot until
  you can't go on without one.
- Dumps fail on the drawer, Home, agent pages, model pages and screens still
  moving, and sometimes return an old tree. Take screenshots there, small,
  and say in the results file how many you took and why.
- Screenshots never go into the repo. Write what they showed in words.
- Keep the screen on (`adb shell svc power stayon usb`) and set
  `adb shell svc power stayon false` at the end. Turn the screen off only
  when the plan says so.
- If the phone shows its lock, stop and wait: only I can unlock it. Never
  try to unlock it.
- Reboot the phone only when the plan says so, and only after the session
  that started you says go.

## Chats, agents and privacy

- Never print secrets: no tokens, keys, passwords, sign-in files or `.env`
  contents, in notes, logs, evidence or the results file.
- Prefer new chats over existing ones. Report which chats you touched and
  anything you sent that the plan didn't ask for.
- Look only at PhoneCanDo's notifications. Don't scroll through my
  personal ones.
- Don't answer an agent's own questions (trust a folder, sign in) unless
  the plan says so.
- Leave the phone as you found it, and list anything you changed and left.

## Results

- **Pass:** the app did what the case expects.
- **Fail:** the app did the wrong thing.
- **Flaky:** tries on the same build disagree. Give the count, such as
  2/3 passed.
- **Blocked:** you or your tools couldn't finish it: you missed a short
  window, a dump failed, the phone locked, a step needed me. Say what
  blocked it. A tester's mistake is never a Fail.
- **Not run:** in the plan but not reached. Say why.

Judge by the end state on the phone: a log line, a dump's text, a file, a
row on a page. An agent saying it did something is not proof.

Try a step at most twice more after a miss, then report what you saw.

## Evidence

- Put log lines and other text in `evidence/<ID>.txt`, short: only the
  lines that show the result.
- Short screen text goes straight into the results file's row, in quotes.
- No secrets, no chat transcripts, no prompt text from a detailed log, no
  personal data.

## The results file

Write `results.md` in the round's folder, in the shape of
[results.md](results.md): one row per case ID in the plan, IDs written
exactly as the plan writes them, linked to their case.
