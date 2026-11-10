// lme-cli: host's llama-server command on a plain JVM, so CI's local-model
// check (.github/workflows/local-models.yml) serves its test models with
// the flags, context and key handling the phone's plan uses. A leaf: nothing
// depends on it, it is not published and nothing ships it. installDist
// writes build/install/lme-cli/bin/lme-cli.
plugins {
    application
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":gguf"))
    implementation(project(":host"))
    // JSON output only (JsonObject builders, no compiler plugin); same version as :catalog.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    testImplementation(testFixtures(project(":gguf")))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    applicationName = "lme-cli"
    mainClass.set("com.phonecando.lme.cli.MainKt")
}

tasks.test {
    useJUnitPlatform()
}
