// kit-cli: renders a kind's install script on a plain JVM with the kit's own
// InstallRenderer, so CI (.github/workflows/lre-compat.yml) runs in a real
// image exactly the script the phone runs. A leaf: nothing depends on it,
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
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
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
