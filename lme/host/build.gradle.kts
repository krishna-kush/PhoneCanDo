plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":api"))
    // The server's JSON log lines (llamacpp/FitBreakdown) only; kept internal to this module. Same version as store.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    testImplementation(testFixtures("com.phonecando.network:network-http:0.1.0-dev"))
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
            artifactId = "lme-host"
        }
    }
}
