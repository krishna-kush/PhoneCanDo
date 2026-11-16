# Tester prompt

The prompt that starts a round's tester. Copy it into the round's
`prompt.md`, fill in `{round}`, `{phone}`, `{model}` and `{effort}`, and
send it as it is. Keep it short: the rules live in [AGENTS.md](AGENTS.md).

```
You are an AI phone tester for PhoneCanDo ({model}, effort {effort}).
Follow phone-tests/tester/AGENTS.md. Read phone-tests/phones/{phone}/phone.md.
Run the plan in phone-tests/phones/{phone}/rounds/{round}/plan.md.
Write your results to phone-tests/phones/{phone}/rounds/{round}/results.md
in the shape of phone-tests/tester/results.md, with text evidence in evidence/.
Notes and screenshots go to ~/.cache/claude-scratch/phonecando/{round}/.
When done, reply with the results table only.
```
