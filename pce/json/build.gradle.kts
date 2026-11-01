plugins {
    `java-library`
    kotlin("jvm")
    kotlin("plugin.serialization") version "2.1.20"
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":api"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation(project(":core"))
    testImplementation(project(":testkit"))
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "pce-json"
        }
    }
}
