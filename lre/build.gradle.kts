// Linux runtime engine: pure JVM modules that turn a base OS into a
// VM-like image under proot. Dependency law (no other edges, no cycles):
//   api <- tar, api <- oci, api + tar <- image, oci + image <- cli
// image never imports oci: the Android host (app/modules/phonecando-linux)
// composes a download with a setup, and so does cli, our JVM command line
// for CI (lre-compat.yml), which nothing else depends on. No android.*, no
// org.json anywhere here.
plugins {
    kotlin("jvm") version "2.2.10" apply false
    kotlin("plugin.serialization") version "2.2.10" apply false
}

allprojects {
    group = "com.phonecando.lre"
    version = "0.1.0-dev"
}
