// Local model engine: pure JVM modules that find, fetch, check and serve
// model weights on the phone. Dependency law (no other edges, no cycles):
//   api <- gguf, api <- catalog, api + gguf <- store, api <- host,
//   gguf + host <- cli (lme-cli, a leaf for CI)
// catalog and store never import each other: a host passes what the catalog
// found (a download plan) to the store. host plans the model server from a
// record and the device and never reads a file. No android.*, no org.json
// anywhere here.
plugins {
    kotlin("jvm") version "2.1.20" apply false
    kotlin("plugin.serialization") version "2.1.20" apply false
}

allprojects {
    group = "com.phonecando.lme"
    version = "0.1.0-dev"
}
