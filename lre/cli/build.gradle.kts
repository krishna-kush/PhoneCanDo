// lre-cli: the real oci download and image setup on a plain JVM, so CI
// (.github/workflows/lre-compat.yml) tests distro images with exactly the
// setup code the phone runs. Not published and not shipped: nothing depends
// on this module.
plugins {
    application
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":oci"))
    implementation(project(":image"))
    // JSON output only (JsonObject builders, no compiler plugin); same version as :oci.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    // installDist writes build/install/cli/bin/cli.
    mainClass.set("com.phonecando.lre.cli.MainKt")
}

tasks.test {
    useJUnitPlatform()
    systemProperty("java.io.tmpdir", temporaryDir.absolutePath)
}
