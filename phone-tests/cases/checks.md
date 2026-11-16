# Capability check cases

What it can do on an agent's page, and its Check now.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="check-01"></a>

### CHECK-01 Check now on new agents of other kinds

- **Agents:** a new Codex agent, Qwen Code (A-14), a new goose agent.
- **Setup:** none.
- **Steps:** On each agent's page, open What it can do and run Check now.
- **Expect:** Each row ends Checked, Not checked yet, Not working or Off,
  with its reason. No check hangs.
- **Touches:** runner `checks/now/`, `checks/rules/`; app
  `ui/env/agent/checks/`.

<a id="check-02"></a>

### CHECK-02 Check now starts an agent that ran in its own app again afterwards

- **Agents:** A-04.
- **Setup:** A-04 running in its own app (Home shows its terminal).
- **Steps:** On its page, What it can do, run Check now (Check all again).
- **Expect:** The check ends in about 15 seconds. A-04 is running again in
  its own app, in the same chat. Home shows "Check done · See results".
- **Touches:** runner `checks/now/` (`CheckNow.kt`, `CheckRuns.kt`).

<a id="check-03"></a>

### CHECK-03 Stop on Home during the check's ACP part ends the whole check

- **Agents:** A-04.
- **Setup:** A-04 running in its own app.
- **Steps:** Run Check all again. As soon as Home shows "Checking Claude
  Code" with STOP, tap STOP (or the check page's Cancel check).
- **Expect:** No "PhoneCanDo check: reply with just the word done" prompt
  shows in its own app afterwards. The check page reads cancelled. A-04 is
  back in its own app.
- **Touches:** runner `checks/now/` (`CheckNow.kt`, `CheckNowRules.kt`).
- **Note:** The ACP part lasts under 10 seconds, so check the screen right
  after starting.

<a id="check-04"></a>

### CHECK-04 The notification's Stop during a check

- **Agents:** A-04.
- **Setup:** A-04 running in its own app.
- **Steps:** Run Check all again, then tap Stop in PhoneCanDo's
  notification while it checks.
- **Expect:** The whole check ends, as in [CHECK-03](#check-03).
- **Touches:** runner `checks/now/`, `notify/`.
- **Note:** Low priority: unit tests cover it.

<a id="check-05"></a>

### CHECK-05 A guessed stop after Esc

- **Agents:** A-04.
- **Setup:** A-04 running in its own app.
- **Steps:** Run Check all again. During the own-app part, press Esc in
  Claude Code.
- **Expect:** The check ends as stopped soon after, not at its 30-minute
  limit.
- **Touches:** runner `checks/now/`.
- **Note:** A known gap, so this would fail today: an Esc in the agent's own
  app is only a guessed stop, and a check ignores guessed stops, so the
  check's 30-minute limit ends it. No unit test covers this case.
  `docs/planning/todo.md` has the open item.
