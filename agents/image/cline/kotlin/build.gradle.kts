plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":kit-api"))
    // Reads Cline's providers.json; the same JSON library and version as
    // kit-manifest, which the runner already ships.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    // The tests load ../agent.json the way the runner does.
    testImplementation(project(":kit-manifest"))
    testImplementation(project(":kit-render"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    val manifest = file("../agent.json")
    val node = file("../../../runtimes/node/runtime.json")
    inputs.file(manifest)
    inputs.file(node)
    systemProperty("phonecando.agentJson", manifest.absolutePath)
    systemProperty("phonecando.nodeRuntimeJson", node.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "agents-cline"
        }
    }
}
