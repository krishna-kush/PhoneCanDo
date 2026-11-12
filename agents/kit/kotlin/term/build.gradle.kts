plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    // A TUI engine's terminal stream, pure: signals in its output, the
    // manifest's PTY rules over them (EngineEvent, PtyRule) and its screen.
    api(project(":kit-api"))
    api(project(":kit-manifest"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.3")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "agents-kit-term"
        }
    }
}
