plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

// Every kind settings.gradle.kts found under {native,image}/<id>/kotlin, so a
// new kind needs no edit here. `implementation`, not `api`: the runner sees
// a kind's code only as kit-api's KindHooks, through BuiltinHooks.
@Suppress("UNCHECKED_CAST")
val agentKinds = gradle.extra["agentKinds"] as List<String>

dependencies {
    api(project(":kit-api"))
    agentKinds.forEach { implementation(project(":$it")) }
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "agents-builtin"
        }
    }
}
