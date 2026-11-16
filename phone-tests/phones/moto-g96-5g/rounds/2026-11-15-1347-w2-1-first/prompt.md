# Prompt: 2026-11-15-1347-w2-1-first

Rebuilt from the plan file; the exact prompt was not kept. It pointed the
tester at the plan in [plan.md](plan.md), and, like every tester prompt of
these rounds, told it to:

- read no code, and test only through adb;
- check the screen with `uiautomator dump`, and take no screenshot until it
  couldn't go on without one;
- never print secrets;
- prefer new chats over existing ones, and report which chats it touched.
