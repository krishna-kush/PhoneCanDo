// Agent kinds: pure JVM modules the runner (app/modules/phonecando-runner)
// builds against. Dependency law (no other edges, no cycles):
//   kit-api <- kit-manifest <- kit-render (which also uses kit-api)
//   kit-api, kit-manifest <- kit-term
//   kit-* <- <kind>, every <kind> <- builtin
//   kit-* <- kit-cli, a leaf: nothing depends on it, nothing ships it
// The runner depends on kit-api, kit-manifest, kit-render, kit-term and
// builtin, never on a kind. No kind depends on another. No android.* here; opencode alone
// may compile against org.json (Android ships it), never package it.
plugins {
    kotlin("jvm") version "2.1.20" apply false
}

allprojects {
    group = "com.phonecando.agents"
    version = "0.1.0-dev"
}
