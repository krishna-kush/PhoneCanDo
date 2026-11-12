plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
    kotlin("plugin.serialization")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":api"))
    // Same version as lre (lre/oci); kept internal to this module.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    testImplementation(testFixtures("com.phonecando.network:network-http:0.1.0-dev"))
    // Tests only: SuggestedRamTest checks suggested.json's phone sizes against host's RAM gate.
    testImplementation(project(":host"))
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
            artifactId = "lme-catalog"
        }
    }
}
