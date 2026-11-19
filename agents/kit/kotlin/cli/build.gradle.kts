// kit-cli: renders on a plain JVM with the kit's own code what CI runs as
// the phone would: a kind's install script (InstallRenderer, for
// lre-compat.yml and local-models.yml) and its one-shot run with a local
// model (ModelSeam, for local-models.yml). A leaf: nothing depends on it,
// it is not published and nothing ships it (kit/cli/deps/kotlin-law.mjs).
// installDist writes build/install/kit-cli/bin/kit-cli.
plugins {
    application
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":kit-render"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.3")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    mainClass.set("com.phonecando.agents.kit.cli.MainKt")
}

tasks.test {
    useJUnitPlatform()
    // The schema's fixtures: a kind and a runtime to render.
    val fixtures = file("../../schema/fixtures")
    inputs.dir(fixtures)
    systemProperty("phonecando.fixtures", fixtures.absolutePath)
}
