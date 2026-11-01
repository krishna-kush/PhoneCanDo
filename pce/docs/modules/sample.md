# PCE sample

Runnable proof that a host can use the PCE without PhoneCanDo or Android. This
module is part of the `pce/` composite build and depends on `core` and
`testkit` as projects.

```bash
cd pce
./gradlew :sample:run
```

It observes the test fixture, resolves a view id, prints an `AMBIGUOUS` result
for duplicate text, taps the resolved node and runs an assert. Expected output
is in `../README.md`.

For the published-coordinate proof, use `consumer-sample.md`.
