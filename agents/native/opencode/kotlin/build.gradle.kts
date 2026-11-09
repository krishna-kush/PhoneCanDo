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
    // Android ships org.json: compile against it, never package it. The JVM
    // tests need the real one (android.jar's is a stub).
    compileOnly("org.json:json:20250517")
    testImplementation("org.json:json:20250517")
    // The tests render ../agent.json the way the runner does.
    testImplementation(project(":kit-manifest"))
    testImplementation(project(":kit-render"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    val manifest = file("../agent.json")
    inputs.file(manifest)
    systemProperty("phonecando.agentJson", manifest.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "agents-opencode"
        }
    }
}
